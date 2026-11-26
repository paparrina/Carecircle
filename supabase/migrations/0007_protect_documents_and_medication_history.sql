begin;

-- A document and its Storage object have one classification, in one circle.
update storage.buckets set public = false where id = 'documents';

alter table public.document_folders
  add constraint document_folders_id_circle_key unique (id, circle_id);

alter table public.documents
  drop constraint documents_folder_id_fkey,
  add constraint documents_folder_circle_fkey
    foreign key (folder_id, circle_id)
    references public.document_folders (id, circle_id)
    on delete set null (folder_id),
  add constraint documents_storage_path_key unique (storage_path),
  add constraint documents_storage_circle_check
    check (storage_path like ('circles/' || circle_id::text || '/_%'));

-- Editors may clean up an upload whose metadata could not be saved. Viewers
-- can only read an object if its unique, matching document row is visible.
drop policy docs_storage_select_member on storage.objects;
create policy docs_storage_select_member on storage.objects
  for select to authenticated using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'circles'
    and (
      public.can_edit_circle(((storage.foldername(name))[2])::uuid)
      or exists (
        select 1 from public.documents d
        where d.storage_path = storage.objects.name
          and d.circle_id = ((storage.foldername(storage.objects.name))[2])::uuid
          and not d.sensitive
      )
    )
  );

alter table public.medications
  add column archived_at timestamptz,
  add constraint medications_archived_inactive check (archived_at is null or not active);

alter table public.medication_schedules add column retired_at timestamptz;

-- Prevent schedule/medication deletions from destroying doses, while allowing
-- the existing circle deletion cascade to remove the entire circle together.
alter table public.medication_logs
  drop constraint medication_logs_schedule_id_fkey,
  add constraint medication_logs_schedule_id_fkey
    foreign key (schedule_id) references public.medication_schedules(id);

-- The medication row serializes edits. RLS applies as the calling user.
create function public.save_medication_with_schedules(
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

  for v_time in select distinct unnest(p_times) loop
    select id into v_schedule_id
    from public.medication_schedules
    where medication_id = v_id and time_of_day = v_time
    order by retired_at desc nulls first, id
    limit 1;

    if v_schedule_id is null then
      insert into public.medication_schedules (medication_id, time_of_day, days_of_week)
      values (v_id, v_time, p_days)
      returning id into v_schedule_id;
    else
      update public.medication_schedules
      set days_of_week = p_days, retired_at = null
      where id = v_schedule_id;
    end if;

    v_kept_ids := array_append(v_kept_ids, v_schedule_id);
  end loop;

  update public.medication_schedules
  set retired_at = now()
  where medication_id = v_id and retired_at is null and id <> all(v_kept_ids);

  return v_id;
end;
$$;

revoke execute on function public.save_medication_with_schedules(uuid, uuid, text, text, text, uuid, time[], int[])
  from public, anon;
grant execute on function public.save_medication_with_schedules(uuid, uuid, text, text, text, uuid, time[], int[])
  to authenticated;

-- Retired schedules must not generate reminders.
create or replace function public.run_notification_sweep()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_local timestamp := (now() at time zone 'Europe/Madrid');
  v_today date := v_local::date;
  v_time  time := v_local::time;
  v_dow   int  := extract(isodow from v_local)::int; -- 1=lunes..7=domingo
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

  -- 2) Tomas no registradas: +45 min → responsable (o todos si sin asignar)
  perform public.push_notification(
    tgt.user_id, m.circle_id, 'med_missed',
    jsonb_build_object('med', m.name,
                       'time', to_char(s.time_of_day, 'HH24:MI')),
    'med:' || s.id || ':' || v_today || ':45:' || tgt.user_id
  )
  from public.medication_schedules s
  join public.medications m on m.id = s.medication_id and m.active
  join lateral (
    select cm.user_id from public.circle_members cm
    where cm.circle_id = m.circle_id
      and (m.assigned_to is null or cm.user_id = m.assigned_to)
  ) tgt on true
  where s.retired_at is null
    and s.days_of_week @> array[v_dow]
    and v_local > (v_today + s.time_of_day) + interval '45 minutes'
    and not exists (
      select 1 from public.medication_logs l
      where l.schedule_id = s.id and l.due_date = v_today
    );

  -- 2b) Escalado +90 min → también coordinadores
  perform public.push_notification(
    cm.user_id, m.circle_id, 'med_missed',
    jsonb_build_object('med', m.name,
                       'time', to_char(s.time_of_day, 'HH24:MI'),
                       'escalated', true),
    'med:' || s.id || ':' || v_today || ':90:' || cm.user_id
  )
  from public.medication_schedules s
  join public.medications m on m.id = s.medication_id and m.active
  join public.circle_members cm
    on cm.circle_id = m.circle_id and cm.role = 'coordinator'
  where s.retired_at is null
    and s.days_of_week @> array[v_dow]
    and v_local > (v_today + s.time_of_day) + interval '90 minutes'
    and not exists (
      select 1 from public.medication_logs l
      where l.schedule_id = s.id and l.due_date = v_today
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
