-- =============================================================
-- Cerca · 0004_notifications.sql (Tarea 9)
-- Notificaciones in-app: triggers instantáneos + barrido programado
-- =============================================================

alter table public.notifications
  add column if not exists dedup_key text,
  add column if not exists email_sent_at timestamptz;

create unique index if not exists idx_notifications_dedup
  on public.notifications (dedup_key) where dedup_key is not null;

-- Insertar sin duplicar (idempotente gracias a dedup_key)
create or replace function public.push_notification(
  p_user uuid, p_circle uuid, p_type text, p_payload jsonb, p_dedup text default null
) returns void
language sql security definer set search_path = public
as $$
  insert into public.notifications (user_id, circle_id, type, payload, dedup_key)
  values (p_user, p_circle, p_type, p_payload, p_dedup)
  on conflict (dedup_key) do nothing;
$$;

-- ---------- TRIGGERS INSTANTÁNEOS ----------

-- Nuevo post: 'mention' para los mencionados, 'new_post' para el resto
create or replace function public.trg_notify_post()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_author text;
begin
  select full_name into v_author from public.profiles where id = new.author_id;
  perform public.push_notification(
    cm.user_id, new.circle_id,
    case when cm.user_id = any(new.mentions) then 'mention' else 'new_post' end,
    jsonb_build_object('author', split_part(coalesce(v_author,''), ' ', 1),
                       'excerpt', left(coalesce(new.body,''), 80)),
    'post:' || new.id || ':' || cm.user_id
  )
  from public.circle_members cm
  where cm.circle_id = new.circle_id and cm.user_id <> new.author_id;
  return new;
end;
$$;
create trigger on_post_created after insert on public.posts
  for each row execute function public.trg_notify_post();

-- Nuevo comentario: avisa al autor del post (si no es quien comenta)
create or replace function public.trg_notify_comment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_post public.posts;
  v_author text;
begin
  select * into v_post from public.posts where id = new.post_id;
  if v_post.author_id is null or v_post.author_id = new.author_id then
    return new;
  end if;
  select full_name into v_author from public.profiles where id = new.author_id;
  perform public.push_notification(
    v_post.author_id, v_post.circle_id, 'new_comment',
    jsonb_build_object('author', split_part(coalesce(v_author,''), ' ', 1),
                       'excerpt', left(new.body, 80)),
    'comment:' || new.id
  );
  return new;
end;
$$;
create trigger on_comment_created after insert on public.post_comments
  for each row execute function public.trg_notify_comment();

-- Documento subido (los sensibles solo avisan a coordinator/member)
create or replace function public.trg_notify_document()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_author text;
begin
  select full_name into v_author from public.profiles where id = new.uploaded_by;
  perform public.push_notification(
    cm.user_id, new.circle_id, 'doc_uploaded',
    jsonb_build_object('author', split_part(coalesce(v_author,''), ' ', 1),
                       'doc', new.name),
    'doc:' || new.id || ':' || cm.user_id
  )
  from public.circle_members cm
  where cm.circle_id = new.circle_id
    and cm.user_id <> new.uploaded_by
    and (not new.sensitive or cm.role in ('coordinator','member'));
  return new;
end;
$$;
create trigger on_document_created after insert on public.documents
  for each row execute function public.trg_notify_document();

-- Nuevo miembro
create or replace function public.trg_notify_member()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = new.user_id;
  perform public.push_notification(
    cm.user_id, new.circle_id, 'member_joined',
    jsonb_build_object('name', split_part(coalesce(v_name,''), ' ', 1)),
    'join:' || new.id || ':' || cm.user_id
  )
  from public.circle_members cm
  where cm.circle_id = new.circle_id and cm.user_id <> new.user_id;
  return new;
end;
$$;
create trigger on_member_joined after insert on public.circle_members
  for each row execute function public.trg_notify_member();

-- ---------- BARRIDO PROGRAMADO (cada 5 min con pg_cron) ----------
-- Evalúa: recordatorios de eventos, tomas no registradas (+45/+90 min)
-- y fechas importantes (a las 09:00 hora de Madrid).

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
    and v_time > s.time_of_day + interval '45 minutes'
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
    and v_time > s.time_of_day + interval '90 minutes'
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
            when make_date(extract(year from v_today)::int,
                           extract(month from d.date)::int,
                           extract(day from d.date)::int) >= v_today
            then make_date(extract(year from v_today)::int,
                           extract(month from d.date)::int,
                           extract(day from d.date)::int)
            else make_date(extract(year from v_today)::int + 1,
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

-- Programación con pg_cron (si la extensión está disponible en el proyecto)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'carecircle-notification-sweep',
    '*/5 * * * *',
    $cron$select public.run_notification_sweep()$cron$
  );
exception when others then
  raise notice 'pg_cron no disponible: programa run_notification_sweep() manualmente (Database → Cron Jobs en Supabase).';
end;
$$;
