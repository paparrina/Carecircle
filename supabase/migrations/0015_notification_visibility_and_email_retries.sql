begin;

-- Existing document notices include the document identifier in their dedup key.
alter policy notifications_select_own on public.notifications using (
  user_id = auth.uid()
  and (circle_id is null or public.is_circle_member(circle_id))
  and (type <> 'doc_uploaded' or exists (
    select 1 from public.documents d
    where d.circle_id = notifications.circle_id
      and d.id::text = split_part(notifications.dedup_key, ':', 2)
  ))
);

alter table public.notifications
  add column email_attempts integer not null default 0,
  add column email_next_attempt_at timestamptz;

grant update (email_attempts, email_next_attempt_at) on public.notifications to service_role;

create function public.pending_notification_emails()
returns table (id uuid, user_id uuid, email_attempts integer)
language sql security invoker set search_path = ''
as $$
  select n.id, n.user_id, n.email_attempts from public.notifications n
  where n.type in ('event_reminder','med_missed','mention','important_date')
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
grant select on public.circle_members to service_role;
revoke execute on function public.pending_notification_emails() from public, anon, authenticated;
grant execute on function public.pending_notification_emails() to service_role;

create or replace function public.run_notification_sweep()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_local timestamp := (now() at time zone 'Europe/Madrid');
  v_today date := v_local::date;
  v_time  time := v_local::time;
begin
  -- 1) Recordatorios de eventos (según reminder_minutes)
  perform public.push_notification(
    tgt.user_id, e.circle_id, 'event_reminder',
    jsonb_build_object('title', e.title,
                       'time', to_char(e.starts_at at time zone 'Europe/Madrid', 'HH24:MI'),
                       'event_id', e.id, 'minutes', r.m),
    'evt:' || e.id || ':' || extract(epoch from e.starts_at)::bigint || ':' || r.m || ':' || tgt.user_id
  )
  from public.events e
  cross join lateral unnest(e.reminder_minutes) as r(m)
  join lateral (
    select cm.user_id from public.circle_members cm
    where cm.circle_id = e.circle_id
      and (e.assigned_to is null or cm.user_id = e.assigned_to)
  ) tgt on true
  where e.completed_at is null
    and now() >= e.starts_at - make_interval(mins => r.m)
    and now() <  e.starts_at;

  -- Use the scheduled date for weekday selection, dose logs and deduplication.
  -- For yesterday, only consider alerts whose threshold reached midnight or later.
  perform public.push_notification(
    cm.user_id, m.circle_id, 'med_missed',
    jsonb_build_object('med', m.name, 'time', to_char(s.time_of_day, 'HH24:MI'))
      || case when alert.minutes = 90 then '{"escalated": true}'::jsonb else '{}'::jsonb end,
    'med:' || s.id || ':' || occurrence.due_date || ':' || alert.minutes || ':' || cm.user_id
  )
  from public.medication_schedules s
  join public.medications m on m.id = s.medication_id and m.active
  join public.circle_members cm on cm.circle_id = m.circle_id
  cross join (values (v_today - 1), (v_today)) occurrence(due_date)
  cross join (values (45), (90)) alert(minutes)
  cross join lateral (
    select occurrence.due_date + s.time_of_day + make_interval(mins => alert.minutes) as deadline
  ) timing
  where (occurrence.due_date + s.time_of_day) at time zone 'Europe/Madrid'
       >= coalesce(s.effective_at, m.created_at)
    and (occurrence.due_date + s.time_of_day) at time zone 'Europe/Madrid'
       < coalesce(s.retired_at, 'infinity'::timestamptz)
    and s.days_of_week @> array[extract(isodow from occurrence.due_date)::int]
    and timing.deadline >= v_today::timestamp
    and timing.deadline <= v_local
    and (
      (alert.minutes = 45 and (m.assigned_to is null or cm.user_id = m.assigned_to))
      or (alert.minutes = 90 and cm.role = 'coordinator')
    )
    and not exists (
      select 1 from public.medication_logs l
      where l.schedule_id = s.id and l.due_date = occurrence.due_date
    );

  -- 3) Fechas importantes: a partir de las 09:00, X días antes
  if v_time >= time '09:00' then
    perform public.push_notification(
      cm.user_id, d.circle_id, 'important_date',
      jsonb_build_object('title', d.title, 'days', rd.n, 'type', d.type),
      'impdate:' || d.id || ':' || nx.next_date || ':' || rd.n || ':' || cm.user_id
    )
    from public.important_dates d
    cross join lateral unnest(d.remind_days_before) as rd(n)
    cross join lateral (
      select case
        when not d.recurring then d.date
        else (
          case
            when public.safe_make_date(extract(year from v_today)::int,
                           extract(month from d.date)::int,
                           extract(day from d.date)::int) >= v_today
            then public.safe_make_date(extract(year from v_today)::int,
                           extract(month from d.date)::int,
                           extract(day from d.date)::int)
            else public.safe_make_date(extract(year from v_today)::int + 1,
                           extract(month from d.date)::int,
                           extract(day from d.date)::int)
          end)
      end as next_date
    ) nx
    join public.circle_members cm on cm.circle_id = d.circle_id
    where nx.next_date - v_today = rd.n;
  end if;
end;
$$;

commit;
