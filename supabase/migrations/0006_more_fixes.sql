-- =============================================================
-- Cerca · 0006_more_fixes.sql
-- Segunda tanda de correcciones de la auditoría (no P0, pero con impacto real):
--   1) get_invitation_info filtraba nombres de una invitación inválida/caducada.
--   2) accept_invitation no comprobaba el email en invitaciones nominales, y su
--      consumo no era atómico.
--   3) La garantía de "al menos un coordinador" solo vivía en código de app.
--   4) Autoría/fecha de logs de medicación, documentos y posts eran editables
--      sin dejar rastro.
--   5) El recordatorio de un evento reprogramado no se reenviaba (dedup_key no
--      dependía de la hora del evento).
-- =============================================================

-- ---------- 1) No filtrar nombres de una invitación inválida/caducada ----------

create or replace function public.get_invitation_info(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_valid boolean;
  v jsonb;
begin
  select (i.accepted_at is null and i.expires_at > now()) into v_valid
  from public.invitations i
  where i.token = p_token;

  if v_valid is not true then
    return jsonb_build_object('valid', false);
  end if;

  select jsonb_build_object(
    'valid', true,
    'role', i.role,
    'circle_name', c.name,
    'recipient_name', r.full_name,
    'inviter_name', p.full_name
  )
  into v
  from public.invitations i
  join public.care_circles c on c.id = i.circle_id
  left join public.care_recipients r on r.circle_id = c.id
  left join public.profiles p on p.id = i.invited_by
  where i.token = p_token;

  return v;
end;
$$;

-- ---------- 2) accept_invitation: verificación de email + consumo atómico ----------
-- Antes cualquiera con el token de una invitación nominal (email is not null) podía
-- aceptarla desde cualquier cuenta, y dos aceptaciones simultáneas podían colarse
-- ambas antes de marcarla usada (select-then-update no atómico).

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_inv public.invitations;
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_inv from public.invitations
  where token = p_token and accepted_at is null and expires_at > now();

  if v_inv.id is null then
    raise exception 'invitation_invalid_or_expired';
  end if;

  if v_inv.email is not null then
    select email into v_user_email
    from auth.users
    where id = auth.uid() and email_confirmed_at is not null;

    if v_user_email is null or lower(v_user_email) <> lower(v_inv.email) then
      raise exception 'invitation_email_mismatch';
    end if;

    -- Consumo atómico: solo una sesión puede pasar accepted_at de null a now().
    update public.invitations set accepted_at = now()
    where id = v_inv.id and accepted_at is null;
    if not found then
      raise exception 'invitation_already_used';
    end if;
  end if;
  -- Las invitaciones genéricas (email is null) siguen siendo multiuso a propósito.

  insert into public.circle_members (circle_id, user_id, role)
  values (v_inv.circle_id, auth.uid(), v_inv.role)
  on conflict (circle_id, user_id) do nothing;

  return v_inv.circle_id;
end;
$$;

-- ---------- 3) Nunca dejar un círculo sin coordinador (a nivel de BD) ----------
-- La comprobación en src/lib/members/actions.ts (contar coordinadores antes de
-- actualizar/borrar) es un check-then-act no atómico: dos peticiones simultáneas
-- podían pasar la comprobación a la vez, o alguien podía saltársela llamando
-- directamente a la API de Supabase. Este trigger lo impide siempre, en la misma
-- transacción.

create or replace function public.circle_members_prevent_zero_coordinators()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_circle_id uuid := old.circle_id;
  v_remaining int;
begin
  if old.role = 'coordinator' and (tg_op = 'DELETE' or new.role <> 'coordinator') then
    select count(*) into v_remaining
    from public.circle_members
    where circle_id = v_circle_id and role = 'coordinator' and id <> old.id;
    if v_remaining = 0 then
      raise exception 'circle_requires_at_least_one_coordinator';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists circle_members_prevent_zero_coordinators on public.circle_members;
create trigger circle_members_prevent_zero_coordinators
  before update or delete on public.circle_members
  for each row execute function public.circle_members_prevent_zero_coordinators();

-- ---------- 4) Autoría y fecha inmutables tras la creación ----------
-- Ningún flujo de la app actualiza estas filas hoy; las políticas de UPDATE
-- existen para casos futuros (editar nota de una toma, mover un documento de
-- carpeta, editar el texto de un post) pero, tal cual estaban, permitían
-- reescribir también quién/cuándo hizo algo y con qué medicamento/círculo se
-- asocia, sin dejar rastro. Fijamos esas columnas a su valor anterior.

create or replace function public.pin_immutable_columns()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'medication_logs' then
    new.logged_by := old.logged_by;
    new.logged_at := old.logged_at;
    new.schedule_id := old.schedule_id;
    new.medication_id := old.medication_id;
    new.circle_id := old.circle_id;
    new.due_date := old.due_date;
  elsif tg_table_name = 'documents' then
    new.uploaded_by := old.uploaded_by;
    new.circle_id := old.circle_id;
    new.storage_path := old.storage_path;
    new.created_at := old.created_at;
  elsif tg_table_name = 'posts' then
    new.author_id := old.author_id;
    new.circle_id := old.circle_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists medication_logs_pin_immutable on public.medication_logs;
create trigger medication_logs_pin_immutable
  before update on public.medication_logs
  for each row execute function public.pin_immutable_columns();

drop trigger if exists documents_pin_immutable on public.documents;
create trigger documents_pin_immutable
  before update on public.documents
  for each row execute function public.pin_immutable_columns();

drop trigger if exists posts_pin_immutable on public.posts;
create trigger posts_pin_immutable
  before update on public.posts
  for each row execute function public.pin_immutable_columns();

-- ---------- 5) Reprogramar un evento debe rearmar su recordatorio ----------
-- El dedup_key de event_reminder no dependía de la hora del evento
-- ('evt:'||id||':'||minutos||':'||user), así que si el recordatorio de las 10:00
-- ya se había enviado y la cita se movía a las 16:00, el recordatorio para la
-- nueva hora quedaba bloqueado por el dedup_key de la hora vieja. Se incluye la
-- hora exacta (en epoch) en la clave para que un cambio de horario genere una
-- clave nueva.

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
