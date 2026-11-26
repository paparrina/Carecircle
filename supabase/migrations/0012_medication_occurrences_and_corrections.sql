begin;

-- Leave pre-existing start times unknown instead of inventing clinical history.
alter table public.medication_schedules add column effective_at timestamptz;
alter table public.medication_schedules alter column effective_at set default now();

alter table public.medication_schedules add constraint medication_schedule_valid_days
  check (cardinality(days_of_week) between 1 and 7
    and array_position(days_of_week, null) is null
    and days_of_week <@ array[1,2,3,4,5,6,7]) not valid;
revoke delete on public.medication_schedules from authenticated;

create function public.medication_schedule_preserve_version()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.effective_at := now();
    new.retired_at := null;
  else
    if (new.medication_id, new.time_of_day, new.days_of_week, new.effective_at)
       is distinct from (old.medication_id, old.time_of_day, old.days_of_week, old.effective_at)
       or (old.retired_at is not null and new.retired_at is distinct from old.retired_at) then
      raise exception 'medication_schedule_version_is_immutable';
    end if;
    if new.retired_at is distinct from old.retired_at then
      new.retired_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger medication_schedule_preserve_version
before insert or update on public.medication_schedules
for each row execute function public.medication_schedule_preserve_version();

create or replace function public.save_medication_with_schedules(
  p_circle_id uuid, p_medication_id uuid, p_name text, p_dosage text,
  p_instructions text, p_assigned_to uuid, p_times time[], p_days int[]
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_id uuid;
  v_time time;
  v_schedule_id uuid;
  v_kept_ids uuid[] := '{}';
  v_days int[];
begin
  if not public.can_edit_circle(p_circle_id) then
    raise exception 'medication_write_denied';
  end if;

  if cardinality(p_times) is null or cardinality(p_times) not between 1 and 8
     or array_position(p_times, null) is not null
     or cardinality(p_days) is null or cardinality(p_days) not between 1 and 7
     or array_position(p_days, null) is not null
     or not (p_days <@ array[1,2,3,4,5,6,7]) then
    raise exception 'invalid_medication_schedule';
  end if;

  if p_assigned_to is not null and not exists (
    select 1 from public.circle_members
    where circle_id = p_circle_id and user_id = p_assigned_to
  ) then
    raise exception 'invalid_medication_assignee';
  end if;

  if p_medication_id is null then
    insert into public.medications (circle_id, name, dosage, instructions, assigned_to, created_by)
    values (p_circle_id, p_name, p_dosage, p_instructions, p_assigned_to, auth.uid())
    returning id into v_id;
  else
    update public.medications
    set name = p_name, dosage = p_dosage, instructions = p_instructions, assigned_to = p_assigned_to
    where id = p_medication_id and circle_id = p_circle_id and archived_at is null
    returning id into v_id;
    if not found then
      raise exception 'medication_not_found';
    end if;
  end if;

  select array_agg(distinct day order by day) into v_days from unnest(p_days) as d(day);

  for v_time in select distinct unnest(p_times) loop
    select id into v_schedule_id
    from public.medication_schedules
    where medication_id = v_id and time_of_day = v_time
      and retired_at is null
      and days_of_week @> v_days and days_of_week <@ v_days
    order by id
    limit 1;

    if v_schedule_id is null then
      insert into public.medication_schedules (medication_id, time_of_day, days_of_week)
      values (v_id, v_time, v_days)
      returning id into v_schedule_id;
    end if;

    v_kept_ids := array_append(v_kept_ids, v_schedule_id);
  end loop;

  update public.medication_schedules
  set retired_at = now()
  where medication_id = v_id and retired_at is null and id <> all(v_kept_ids);

  return v_id;
end;
$$;


create function public.medication_log_check_occurrence()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_schedule public.medication_schedules;
  v_medication public.medications;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_due timestamptz;
begin
  -- The medication lock serializes logging with edits and archiving.
  select m.* into v_medication
  from public.medications m
  join public.medication_schedules s on s.medication_id = m.id
  where s.id = new.schedule_id and public.is_circle_member(m.circle_id)
  for update of m;

  if not found or new.due_date is null or new.due_date not between v_today - 1 and v_today then
    raise exception 'invalid_medication_occurrence';
  end if;

  select * into v_schedule from public.medication_schedules where id = new.schedule_id;
  v_due := (new.due_date + v_schedule.time_of_day) at time zone 'Europe/Madrid';
  if not (extract(isodow from new.due_date)::int = any(v_schedule.days_of_week))
     or v_due < coalesce(v_schedule.effective_at, v_medication.created_at)
     or v_due >= coalesce(v_schedule.retired_at, 'infinity'::timestamptz)
     or v_due >= coalesce(v_medication.archived_at, 'infinity'::timestamptz)
     or (not v_medication.active and v_medication.archived_at is null) then
    raise exception 'invalid_medication_occurrence';
  end if;

  -- Protect a slot even if another schedule version already recorded that time.
  if exists (
    select 1 from public.medication_logs l
    join public.medication_schedules s on s.id = l.schedule_id
    where l.medication_id = v_medication.id and l.due_date = new.due_date
      and s.time_of_day = v_schedule.time_of_day
  ) then
    raise unique_violation using message = 'medication_occurrence_already_logged';
  end if;
  new.logged_at := now();
  return new;
end;
$$;

create trigger medication_logs_validate_occurrence
before insert on public.medication_logs
for each row execute function public.medication_log_check_occurrence();

create table public.medication_log_corrections (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  medication_log_id uuid not null,
  medication_id uuid,
  schedule_id uuid not null,
  due_date date not null,
  previous_status text not null,
  corrected_status text,
  previous_note text,
  corrected_note text,
  original_author uuid,
  original_recorded_at timestamptz not null,
  corrected_by uuid,
  corrected_at timestamptz not null default now()
);
create index medication_log_corrections_circle_date_idx
  on public.medication_log_corrections (circle_id, due_date);
alter table public.medication_log_corrections enable row level security;
grant select on public.medication_log_corrections to authenticated;
create policy medication_log_corrections_member_read
  on public.medication_log_corrections for select to authenticated
  using (public.is_circle_member(circle_id));

create function public.medication_log_record_correction()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Deleting a whole circle removes its data, including its corrections.
  if not exists (select 1 from public.care_circles where id = old.circle_id) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and (new.status, new.note) is not distinct from (old.status, old.note) then
    return new;
  end if;

  insert into public.medication_log_corrections (
    circle_id, medication_log_id, medication_id, schedule_id, due_date,
    previous_status, corrected_status, previous_note, corrected_note,
    original_author, original_recorded_at, corrected_by
  ) values (
    old.circle_id, old.id, old.medication_id, old.schedule_id, old.due_date,
    old.status, case when tg_op = 'UPDATE' then new.status end,
    old.note, case when tg_op = 'UPDATE' then new.note end,
    old.logged_by, old.logged_at, auth.uid()
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger medication_logs_record_correction
after update or delete on public.medication_logs
for each row execute function public.medication_log_record_correction();

revoke execute on function public.medication_schedule_preserve_version() from public, anon, authenticated;
revoke execute on function public.medication_log_check_occurrence() from public, anon, authenticated;
revoke execute on function public.medication_log_record_correction() from public, anon, authenticated;

commit;
