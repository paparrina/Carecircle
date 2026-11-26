begin;

create function carecircle_private.run_medication_reminder_sweep(p_now timestamptz)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Europe/Madrid')::date;
  v_midnight timestamptz := v_today::timestamp at time zone 'Europe/Madrid';
begin
  -- Eligibility and the deduplication date follow the Madrid calendar.
  -- Convert the occurrence to an instant before adding elapsed minutes.
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
    select (occurrence.due_date + s.time_of_day) at time zone 'Europe/Madrid' as due_at
  ) occurrence_time
  cross join lateral (
    select occurrence_time.due_at + make_interval(mins => alert.minutes) as deadline
  ) timing
  where occurrence_time.due_at >= coalesce(s.effective_at, m.created_at)
    and occurrence_time.due_at < coalesce(s.retired_at, 'infinity'::timestamptz)
    and s.days_of_week @> array[extract(isodow from occurrence.due_date)::int]
    and timing.deadline >= v_midnight
    and timing.deadline <= p_now
    and (
      (alert.minutes = 45 and (m.assigned_to is null or cm.user_id = m.assigned_to))
      or (alert.minutes = 90 and cm.role = 'coordinator')
    )
    and not exists (
      select 1 from public.medication_logs l
      where l.schedule_id = s.id and l.due_date = occurrence.due_date
    );
end;
$$;
revoke execute on function carecircle_private.run_medication_reminder_sweep(timestamptz)
  from public, anon, authenticated, service_role;

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

  perform carecircle_private.run_medication_reminder_sweep(now());

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
