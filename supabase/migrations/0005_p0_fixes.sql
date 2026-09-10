-- =============================================================
-- Cerca · 0005_p0_fixes.sql
-- Corrige defectos P0 de integridad y seguridad detectados en auditoría:
--   1) Storage permite leer objetos de documentos sensibles a un viewer.
--   2) Un medication_log puede referenciar el horario de otro círculo.
--   3) El dedup de avisos falla en Postgres (ON CONFLICT sin el predicado
--      del índice parcial) y aborta la transacción que lo dispara.
--   4) Las RPC internas de avisos son ejecutables por cualquier usuario.
--   5) El cálculo de avisos de toma no registrada usa aritmética de `time`
--      que da la vuelta a medianoche, y una fecha 29 de febrero puede
--      abortar el barrido completo de notificaciones.
-- =============================================================

-- ---------- 1) STORAGE: no servir objetos sensibles a quien no puede verlos ----------
-- La tabla `documents` ya oculta la fila sensible a un viewer, pero la política de
-- Storage solo miraba la pertenencia al círculo, no la fila correspondiente: cualquier
-- miembro con el `storage_path` podía generar una URL firmada o descargar el objeto.

drop policy if exists "docs_storage_select_member" on storage.objects;
create policy "docs_storage_select_member" on storage.objects
  for select using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'circles'
    and exists (
      select 1 from public.documents d
      where d.storage_path = storage.objects.name
        and d.circle_id = ((storage.foldername(name))[2])::uuid
        and (not d.sensitive or public.can_edit_circle(d.circle_id))
    )
  );

-- ---------- 2) medication_logs: impedir mezclar círculos/medicamentos ----------
-- circle_id y medication_id los mandaba el cliente sin comprobarse contra el
-- schedule_id real. Un miembro podía insertar un log con circle_id de su propio
-- círculo pero schedule_id de otro círculo (por ejemplo, de cuando era miembro de
-- ambos, o adivinando/reutilizando un id), corrompiendo el barrido de tomas
-- pendientes de ese horario. Ahora circle_id/medication_id se derivan siempre en
-- servidor a partir del schedule_id real, ignorando lo que mande el cliente.

create or replace function public.medication_logs_fill_from_schedule()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_circle_id uuid;
  v_medication_id uuid;
begin
  select m.circle_id, m.id into v_circle_id, v_medication_id
  from public.medication_schedules s
  join public.medications m on m.id = s.medication_id
  where s.id = new.schedule_id;

  if v_circle_id is null then
    raise exception 'invalid_schedule_id';
  end if;

  new.circle_id := v_circle_id;
  new.medication_id := v_medication_id;
  return new;
end;
$$;

drop trigger if exists medication_logs_fill_from_schedule on public.medication_logs;
create trigger medication_logs_fill_from_schedule
  before insert or update of schedule_id on public.medication_logs
  for each row execute function public.medication_logs_fill_from_schedule();

-- ---------- 3) Dedup de avisos: el ON CONFLICT debe repetir el predicado ----------
-- `idx_notifications_dedup` es un índice único PARCIAL (where dedup_key is not null).
-- Postgres exige que el ON CONFLICT repita ese mismo predicado para poder inferir el
-- índice; si no, lanza "no unique or exclusion constraint matching..." y, al ejecutarse
-- dentro de un trigger, esa excepción deshace también la operación que lo disparó
-- (por ejemplo, publicar en el muro). Además se aísla el fallo con una excepción
-- controlada: un aviso que no se pueda insertar nunca debe impedir la acción principal.

create or replace function public.push_notification(
  p_user uuid, p_circle uuid, p_type text, p_payload jsonb, p_dedup text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, circle_id, type, payload, dedup_key)
  values (p_user, p_circle, p_type, p_payload, p_dedup)
  on conflict (dedup_key) where dedup_key is not null do nothing;
exception when others then
  raise warning 'push_notification: fallo al insertar (user=%, circle=%, type=%, dedup=%): %',
    p_user, p_circle, p_type, p_dedup, sqlerrm;
end;
$$;

-- ---------- 4) Revocar ejecución directa de RPC internas de avisos ----------
-- Por defecto Postgres/PostgREST concede EXECUTE a PUBLIC en funciones nuevas, lo que
-- las expone como endpoint RPC de Supabase a cualquier usuario autenticado (incluso
-- anónimo, según configuración). push_notification no comprueba pertenencia a círculo,
-- así que cualquiera podría llamarla para inyectar avisos falsos a otro usuario;
-- run_notification_sweep no debería poder dispararse a demanda fuera del cron.

revoke execute on function public.push_notification(uuid, uuid, text, jsonb, text)
  from public, anon, authenticated;
revoke execute on function public.run_notification_sweep()
  from public, anon, authenticated;

-- ---------- 5) Avisos de toma no registrada: fecha/hora correctas ----------
-- `s.time_of_day + interval '45 minutes'` es aritmética del tipo `time`, que da la
-- vuelta a medianoche: para una toma de las 23:30, el resultado es 00:15, y
-- `v_time > 00:15` es cierto casi todo el día siguiente. Eso dispara el aviso de
-- "toma no registrada" nada más pasar la medianoche, muchas horas antes de que la
-- toma sea siquiera exigible. Se sustituye por aritmética sobre timestamp completo
-- (fecha + hora), que no da la vuelta.
--
-- Además, `make_date` con un 29 de febrero reconstruido sobre un año no bisiesto
-- lanza una excepción no controlada, que aborta la función completa y con ella TODOS
-- los avisos del barrido (no solo los de fechas importantes). `safe_make_date` la
-- sustituye por el 28 de febrero en ese caso.

create or replace function public.safe_make_date(p_year int, p_month int, p_day int)
returns date
language plpgsql immutable
as $$
begin
  return make_date(p_year, p_month, p_day);
exception when others then
  if p_month = 2 and p_day = 29 then
    return make_date(p_year, 2, 28);
  end if;
  raise;
end;
$$;

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
    'evt:' || e.id || ':' || r.m || ':' || tgt.user_id
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
  --    Comparación por timestamp completo (fecha + hora) para no dar la vuelta a medianoche.
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
  where s.days_of_week @> array[v_dow]
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
  where s.days_of_week @> array[v_dow]
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
