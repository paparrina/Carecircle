-- Run with migrations through 0019. The fixtures are rolled back.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000061', 'reminder-coordinator@example.test'),
  ('00000000-0000-0000-0000-000000000062', 'reminder-member@example.test');
insert into public.care_circles (id, name)
values ('00000000-0000-0000-0000-000000000063', 'Elapsed time fixture');
insert into public.circle_members (circle_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000061', 'coordinator'),
  ('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000062', 'member');
insert into public.medications (id, circle_id, name, dosage, assigned_to, created_at)
values ('00000000-0000-0000-0000-000000000064', '00000000-0000-0000-0000-000000000063',
  'Fake reminder medication', 'One unit', '00000000-0000-0000-0000-000000000062', '2026-01-01 00:00+00');
alter table public.medication_schedules disable trigger medication_schedule_preserve_version;
insert into public.medication_schedules (id, medication_id, time_of_day, days_of_week, effective_at) values
  ('00000000-0000-0000-0000-000000000065', '00000000-0000-0000-0000-000000000064', '01:30', array[7], '2026-01-01 00:00+00'),
  ('00000000-0000-0000-0000-000000000066', '00000000-0000-0000-0000-000000000064', '02:30', array[7], '2026-01-01 00:00+00'),
  ('00000000-0000-0000-0000-000000000067', '00000000-0000-0000-0000-000000000064', '23:30', array[1], '2026-01-01 00:00+00');
alter table public.medication_schedules enable trigger medication_schedule_preserve_version;

-- Insert a historical fixture without the today/yesterday write window.
alter table public.medication_logs disable trigger medication_logs_validate_occurrence;
insert into public.medication_logs (schedule_id, due_date, status, logged_by)
values ('00000000-0000-0000-0000-000000000067', '2026-04-06', 'taken',
  '00000000-0000-0000-0000-000000000062');
alter table public.medication_logs enable trigger medication_logs_validate_occurrence;

do $$
declare
  v_spring_gap text := 'med:00000000-0000-0000-0000-000000000066:2026-03-29:';
  v_spring text := 'med:00000000-0000-0000-0000-000000000065:2026-03-29:';
  v_autumn text := 'med:00000000-0000-0000-0000-000000000065:2026-10-25:';
  v_repeated_hour text := 'med:00000000-0000-0000-0000-000000000066:2026-10-25:';
  v_midnight text := 'med:00000000-0000-0000-0000-000000000067:2026-03-30:';
  v_member text := '00000000-0000-0000-0000-000000000062';
  v_coordinator text := '00000000-0000-0000-0000-000000000061';
begin
  -- Spring: 01:30 Madrid = 00:30 UTC. The local clock jumps to 03:00 at 01:00 UTC.
  perform carecircle_private.run_medication_reminder_sweep('2026-03-29 01:00+00');
  if exists (select from public.notifications where dedup_key like v_spring || '%') then
    raise exception 'Spring reminder fired at 30 elapsed minutes';
  end if;
  perform carecircle_private.run_medication_reminder_sweep('2026-03-29 01:15+00');
  perform carecircle_private.run_medication_reminder_sweep('2026-03-29 01:15+00');
  if (select count(*) from public.notifications where dedup_key like v_spring || '%') <> 1
     or not exists (select from public.notifications where dedup_key = v_spring || '45:' || v_member) then
    raise exception 'Spring 45-minute reminder missing, duplicated or delivered to wrong role';
  end if;
  perform carecircle_private.run_medication_reminder_sweep('2026-03-29 02:00+00');
  if not exists (select from public.notifications where dedup_key = v_spring || '90:' || v_coordinator
      and payload->>'escalated' = 'true') then
    raise exception 'Spring 90-minute escalation missing';
  end if;

  if exists (select from public.notifications where dedup_key like v_spring_gap || '%') then
    raise exception 'Skipped 02:30 produced a reminder early';
  end if;
  perform carecircle_private.run_medication_reminder_sweep('2026-03-29 02:15+00');
  if not exists (select from public.notifications where dedup_key = v_spring_gap || '45:' || v_member) then
    raise exception 'Skipped 02:30 did not advance to 03:30 local time';
  end if;

  -- Autumn: 01:30 Madrid = 23:30 UTC, previous date. The 90-minute threshold
  -- arrives during the second 02:00 local hour.
  perform carecircle_private.run_medication_reminder_sweep('2026-10-25 00:59+00');
  if not exists (select from public.notifications where dedup_key = v_autumn || '45:' || v_member)
     or exists (select from public.notifications where dedup_key like v_autumn || '90:%')
     or exists (select from public.notifications where dedup_key like v_repeated_hour || '%') then
    raise exception 'Autumn schedule produced an early or missing alert';
  end if;
  perform carecircle_private.run_medication_reminder_sweep('2026-10-25 01:00+00');
  if not exists (select from public.notifications where dedup_key = v_autumn || '90:' || v_coordinator) then
    raise exception 'Autumn escalation was delayed by the repeated hour';
  end if;
  perform carecircle_private.run_medication_reminder_sweep('2026-10-25 02:15+00');
  if not exists (select from public.notifications where dedup_key = v_repeated_hour || '45:' || v_member) then
    raise exception 'Repeated 02:30 did not use its standard-time occurrence';
  end if;

  perform carecircle_private.run_medication_reminder_sweep('2026-03-30 22:14+00');
  if exists (select from public.notifications where dedup_key like v_midnight || '%') then
    raise exception 'Midnight reminder fired early';
  end if;
  perform carecircle_private.run_medication_reminder_sweep('2026-03-30 22:15+00');
  if not exists (select from public.notifications where dedup_key = v_midnight || '45:' || v_member) then
    raise exception 'Midnight reminder did not retain its original due date';
  end if;
  perform carecircle_private.run_medication_reminder_sweep('2026-04-06 23:00+00');
  if exists (select from public.notifications
    where dedup_key like 'med:00000000-0000-0000-0000-000000000067:2026-04-06:%') then
    raise exception 'An already logged dose produced a reminder or escalation';
  end if;
end $$;

rollback;
