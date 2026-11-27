begin;

-- Reuse the subscription table and owner policy from 0001.
alter table public.push_subscriptions add constraint push_subscription_valid_shape check (
  length(endpoint) <= 2048
  and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)/'
  and coalesce(keys->>'p256dh', '') ~ '^[A-Za-z0-9_-]{87}$'
  and coalesce(keys->>'auth', '') ~ '^[A-Za-z0-9_-]{22}$'
) not valid;
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);
grant select, delete on public.push_subscriptions to service_role;

create table public.push_deliveries (
  notification_id uuid references public.notifications(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete cascade,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease uuid not null default gen_random_uuid(),
  finished boolean not null default false,
  primary key (notification_id, subscription_id)
);
alter table public.push_deliveries enable row level security;
grant select, update on public.push_deliveries to service_role;

create function public.claim_notification_pushes()
returns table (notification_id uuid, subscription_id uuid, endpoint text, p256dh text,
  auth_key text, circle_id uuid, attempts integer, lease uuid)
language sql security definer set search_path = ''
as $$
  with candidates as (
    select n.id as nid, s.id as sid, s.endpoint, s.keys->>'p256dh' as p256dh, s.keys->>'auth' as auth_key, n.circle_id
    from public.notifications n
    join public.notification_preferences p on p.user_id = n.user_id and p.push_enabled
    join public.push_subscriptions s on s.user_id = n.user_id
    left join public.push_deliveries d on d.notification_id = n.id and d.subscription_id = s.id
    where s.endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)/'
      and n.created_at > now() - interval '1 hour'
      and n.type in ('event_reminder', 'med_missed', 'mention', 'important_date')
      and (d.notification_id is null or (not d.finished and d.attempts < 4 and d.next_attempt_at <= now()))
      and (n.circle_id is null or exists (
        select 1 from public.circle_members m where m.circle_id = n.circle_id and m.user_id = n.user_id
      ))
    order by n.created_at, n.id, s.id
    limit 20
  ), claimed as (
    insert into public.push_deliveries as d
      (notification_id, subscription_id, attempts, next_attempt_at)
    select nid, sid, 1, now() + interval '5 minutes' from candidates
    on conflict on constraint push_deliveries_pkey do update
      set attempts = d.attempts + 1, next_attempt_at = excluded.next_attempt_at,
        lease = gen_random_uuid()
      where not d.finished and d.attempts < 4 and d.next_attempt_at <= now()
    returning d.notification_id, d.subscription_id, d.attempts, d.lease
  )
  select c.nid, c.sid, c.endpoint, c.p256dh, c.auth_key, c.circle_id, d.attempts, d.lease
  from claimed d join candidates c on d.notification_id = c.nid and d.subscription_id = c.sid
$$;
revoke all on function public.claim_notification_pushes() from public, anon, authenticated;
grant execute on function public.claim_notification_pushes() to service_role;

create function public.can_send_notification_push(p_notification uuid, p_subscription uuid, p_lease uuid)
returns boolean language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from public.push_deliveries d
    join public.notifications n on n.id = d.notification_id
    join public.push_subscriptions s on s.id = d.subscription_id and s.user_id = n.user_id
    join public.notification_preferences p on p.user_id = s.user_id and p.push_enabled
    where d.notification_id = p_notification and d.subscription_id = p_subscription
      and d.lease = p_lease and not d.finished
      and (n.circle_id is null or exists (select 1 from public.circle_members m
        where m.circle_id = n.circle_id and m.user_id = s.user_id))
  )
$$;
revoke all on function public.can_send_notification_push(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.can_send_notification_push(uuid, uuid, uuid) to service_role;

commit;
