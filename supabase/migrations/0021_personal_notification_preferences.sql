begin;

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  email_enabled boolean not null default true,
  push_enabled boolean not null default false
);
alter table public.notification_preferences enable row level security;
grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.notification_preferences to service_role;
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.pending_notification_emails()
returns table (id uuid, user_id uuid, email_attempts integer)
language sql security invoker set search_path = ''
as $$
  select n.id, n.user_id, n.email_attempts
  from public.notifications n
  left join public.notification_preferences p on p.user_id = n.user_id
  where coalesce(p.email_enabled, true)
    and n.type in ('event_reminder','med_missed','mention','important_date')
    and n.email_sent_at is null
    and n.created_at >= now() - interval '23 hours'
    and n.email_attempts < 6
    and (n.email_next_attempt_at is null or n.email_next_attempt_at <= now())
    and (n.circle_id is null or exists (
      select 1 from public.circle_members cm
      where cm.circle_id = n.circle_id and cm.user_id = n.user_id
    ))
  order by n.email_next_attempt_at nulls first, n.created_at, n.id
  limit 50
$$;

-- Account-only deletion. Shared circle data needs a separate retention policy.
create function public.delete_empty_account()
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then return false; end if;
  -- Block new foreign-key references while checking shared data.
  perform 1 from auth.users where id = caller for update;
  perform 1 from public.profiles where id = caller for update;
  if exists (select 1 from public.circle_members where user_id = caller)
     or exists (select 1 from storage.objects where owner_id = caller::text) then
    return false;
  end if;
  delete from auth.users where id = caller;
  return found;
exception when foreign_key_violation then
  return false;
end;
$$;
revoke all on function public.delete_empty_account() from public, anon;
grant execute on function public.delete_empty_account() to authenticated;

commit;
