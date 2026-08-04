-- =============================================================
-- Cerca · 0001_init.sql
-- Esquema completo + RLS + Storage. Ver plan MVP §5 y §9.
-- =============================================================

-- ---------- TABLAS ----------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  avatar_url text,
  locale text not null default 'es' check (locale in ('es','en')),
  phone text,
  created_at timestamptz not null default now()
);

create table public.care_circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.care_recipients (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  full_name text not null,
  birth_date date,
  photo_url text,
  blood_type text,
  allergies text[] not null default '{}',
  conditions text[] not null default '{}',
  notes text,
  emergency_contacts jsonb not null default '[]', -- [{name, relation, phone}]
  doctors jsonb not null default '[]',            -- [{name, specialty, phone, address}]
  created_at timestamptz not null default now()
);

create table public.circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('coordinator','member','viewer')),
  joined_at timestamptz not null default now(),
  unique (circle_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  email text,
  token text unique not null default encode(gen_random_bytes(24), 'hex'),
  role text not null default 'member' check (role in ('member','viewer')),
  invited_by uuid references public.profiles(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  title text not null,
  type text not null default 'other' check (type in ('medical','visit','task','other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  notes text,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  reminder_minutes int[] not null default '{1440,60}',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  name text not null,
  dosage text not null,
  instructions text,
  active boolean not null default true,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  time_of_day time not null,
  days_of_week int[] not null default '{1,2,3,4,5,6,7}'
);

create table public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.medication_schedules(id) on delete cascade,
  medication_id uuid references public.medications(id) on delete set null,
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  due_date date not null,
  status text not null check (status in ('taken','skipped','missed')),
  logged_by uuid references public.profiles(id),
  logged_at timestamptz not null default now(),
  note text,
  unique (schedule_id, due_date)
);

create table public.important_dates (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  title text not null,
  date date not null,
  type text not null default 'other' check (type in ('birthday','anniversary','expiry','other')),
  recurring boolean not null default false,
  remind_days_before int[] not null default '{7,1}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.location_checkins (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  place text not null check (place in ('home','day_center','doctor','walk','other')),
  place_label text,
  checked_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.document_folders (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  name text not null
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  folder_id uuid references public.document_folders(id) on delete set null,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  sensitive boolean not null default false,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text,
  attachments jsonb not null default '[]',
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  circle_id uuid references public.care_circles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text unique not null,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------- ÍNDICES ----------

create index idx_circle_members_user on public.circle_members (user_id);
create index idx_circle_members_circle on public.circle_members (circle_id);
create index idx_events_circle_start on public.events (circle_id, starts_at);
create index idx_med_logs_circle_due on public.medication_logs (circle_id, due_date);
create index idx_important_dates_circle_date on public.important_dates (circle_id, date);
create index idx_checkins_circle_created on public.location_checkins (circle_id, created_at desc);
create index idx_posts_circle_created on public.posts (circle_id, created_at desc);
create index idx_notifications_user on public.notifications (user_id, read_at, created_at desc);
create index idx_documents_circle on public.documents (circle_id, folder_id);

-- ---------- FUNCIONES DE AUTORIZACIÓN ----------
-- security definer para evitar recursión de RLS al consultar circle_members.

create or replace function public.get_circle_role(p_circle_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.circle_members
  where circle_id = p_circle_id and user_id = auth.uid()
$$;

create or replace function public.is_circle_member(p_circle_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = p_circle_id and user_id = auth.uid()
  )
$$;

create or replace function public.is_circle_coordinator(p_circle_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = p_circle_id and user_id = auth.uid()
      and role = 'coordinator'
  )
$$;

-- coordinator o member (pueden editar contenido)
create or replace function public.can_edit_circle(p_circle_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = p_circle_id and user_id = auth.uid()
      and role in ('coordinator','member')
  )
$$;

-- ---------- TRIGGER: perfil automático al registrarse ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RPC: crear círculo completo (evita el huevo-gallina de RLS) ----------

create or replace function public.create_circle_with_recipient(
  p_recipient_name text,
  p_birth_date date default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_circle_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if length(trim(p_recipient_name)) < 2 then
    raise exception 'invalid_name';
  end if;

  insert into public.care_circles (name, created_by)
  values ('Círculo de ' || trim(p_recipient_name), auth.uid())
  returning id into v_circle_id;

  insert into public.circle_members (circle_id, user_id, role)
  values (v_circle_id, auth.uid(), 'coordinator');

  insert into public.care_recipients (circle_id, full_name, birth_date)
  values (v_circle_id, trim(p_recipient_name), p_birth_date);

  -- Carpetas de documentos predefinidas
  insert into public.document_folders (circle_id, name) values
    (v_circle_id, 'Informes médicos'),
    (v_circle_id, 'Medicación y recetas'),
    (v_circle_id, 'Seguros'),
    (v_circle_id, 'Identidad'),
    (v_circle_id, 'Legal y voluntades'),
    (v_circle_id, 'Otros');

  return v_circle_id;
end;
$$;

-- RPC: aceptar invitación por token (se usará en T5, definida ya por seguridad)
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_inv public.invitations;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_inv from public.invitations
  where token = p_token and accepted_at is null and expires_at > now();

  if v_inv.id is null then
    raise exception 'invitation_invalid_or_expired';
  end if;

  insert into public.circle_members (circle_id, user_id, role)
  values (v_inv.circle_id, auth.uid(), v_inv.role)
  on conflict (circle_id, user_id) do nothing;

  -- Las invitaciones por email se marcan usadas; el enlace genérico es multiuso
  if v_inv.email is not null then
    update public.invitations set accepted_at = now() where id = v_inv.id;
  end if;

  return v_inv.circle_id;
end;
$$;

-- ---------- RLS ----------

alter table public.profiles enable row level security;
alter table public.care_circles enable row level security;
alter table public.care_recipients enable row level security;
alter table public.circle_members enable row level security;
alter table public.invitations enable row level security;
alter table public.events enable row level security;
alter table public.medications enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.medication_logs enable row level security;
alter table public.important_dates enable row level security;
alter table public.location_checkins enable row level security;
alter table public.document_folders enable row level security;
alter table public.documents enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

-- profiles: cada usuario ve/edita el suyo; los compañeros de círculo pueden verse
create policy "profiles_select_own_or_circlemate" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.circle_members me
      join public.circle_members them on them.circle_id = me.circle_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- care_circles
create policy "circles_select_member" on public.care_circles
  for select using (public.is_circle_member(id));
create policy "circles_update_coordinator" on public.care_circles
  for update using (public.is_circle_coordinator(id))
  with check (public.is_circle_coordinator(id));
create policy "circles_delete_coordinator" on public.care_circles
  for delete using (public.is_circle_coordinator(id));
-- insert solo vía RPC create_circle_with_recipient (security definer)

-- care_recipients
create policy "recipients_select_member" on public.care_recipients
  for select using (public.is_circle_member(circle_id));
create policy "recipients_update_editor" on public.care_recipients
  for update using (public.can_edit_circle(circle_id))
  with check (public.can_edit_circle(circle_id));

-- circle_members: los miembros se ven entre sí; solo coordinator gestiona
create policy "members_select_member" on public.circle_members
  for select using (public.is_circle_member(circle_id));
create policy "members_update_coordinator" on public.circle_members
  for update using (public.is_circle_coordinator(circle_id))
  with check (public.is_circle_coordinator(circle_id));
create policy "members_delete_coordinator_or_self" on public.circle_members
  for delete using (
    public.is_circle_coordinator(circle_id) or user_id = auth.uid()
  );
-- insert vía RPC (create_circle / accept_invitation)

-- invitations: solo coordinator
create policy "invitations_all_coordinator" on public.invitations
  for all using (public.is_circle_coordinator(circle_id))
  with check (public.is_circle_coordinator(circle_id));

-- events
create policy "events_select_member" on public.events
  for select using (public.is_circle_member(circle_id));
create policy "events_insert_editor" on public.events
  for insert with check (public.can_edit_circle(circle_id) and created_by = auth.uid());
create policy "events_update_editor" on public.events
  for update using (public.can_edit_circle(circle_id))
  with check (public.can_edit_circle(circle_id));
create policy "events_delete_editor" on public.events
  for delete using (public.can_edit_circle(circle_id));

-- medications
create policy "meds_select_member" on public.medications
  for select using (public.is_circle_member(circle_id));
create policy "meds_insert_editor" on public.medications
  for insert with check (public.can_edit_circle(circle_id) and created_by = auth.uid());
create policy "meds_update_editor" on public.medications
  for update using (public.can_edit_circle(circle_id))
  with check (public.can_edit_circle(circle_id));
create policy "meds_delete_editor" on public.medications
  for delete using (public.can_edit_circle(circle_id));

-- medication_schedules (autorización a través del medicamento padre)
create policy "med_schedules_select_member" on public.medication_schedules
  for select using (exists (
    select 1 from public.medications m
    where m.id = medication_id and public.is_circle_member(m.circle_id)
  ));
create policy "med_schedules_write_editor" on public.medication_schedules
  for all using (exists (
    select 1 from public.medications m
    where m.id = medication_id and public.can_edit_circle(m.circle_id)
  ))
  with check (exists (
    select 1 from public.medications m
    where m.id = medication_id and public.can_edit_circle(m.circle_id)
  ));

-- medication_logs: TODOS los roles pueden registrar tomas (incluido viewer)
create policy "med_logs_select_member" on public.medication_logs
  for select using (public.is_circle_member(circle_id));
create policy "med_logs_insert_any_member" on public.medication_logs
  for insert with check (public.is_circle_member(circle_id) and logged_by = auth.uid());
create policy "med_logs_update_own_or_editor" on public.medication_logs
  for update using (logged_by = auth.uid() or public.can_edit_circle(circle_id))
  with check (public.is_circle_member(circle_id));

-- important_dates
create policy "dates_select_member" on public.important_dates
  for select using (public.is_circle_member(circle_id));
create policy "dates_write_editor" on public.important_dates
  for all using (public.can_edit_circle(circle_id))
  with check (public.can_edit_circle(circle_id));

-- location_checkins: TODOS los roles pueden hacer check-in (incluido viewer)
create policy "checkins_select_member" on public.location_checkins
  for select using (public.is_circle_member(circle_id));
create policy "checkins_insert_any_member" on public.location_checkins
  for insert with check (public.is_circle_member(circle_id) and checked_by = auth.uid());

-- document_folders
create policy "folders_select_member" on public.document_folders
  for select using (public.is_circle_member(circle_id));
create policy "folders_write_editor" on public.document_folders
  for all using (public.can_edit_circle(circle_id))
  with check (public.can_edit_circle(circle_id));

-- documents: viewer NO ve los sensibles
create policy "documents_select_role_aware" on public.documents
  for select using (
    public.is_circle_member(circle_id)
    and (not sensitive or public.can_edit_circle(circle_id))
  );
create policy "documents_insert_editor" on public.documents
  for insert with check (public.can_edit_circle(circle_id) and uploaded_by = auth.uid());
create policy "documents_update_editor" on public.documents
  for update using (public.can_edit_circle(circle_id))
  with check (public.can_edit_circle(circle_id));
create policy "documents_delete_editor" on public.documents
  for delete using (public.can_edit_circle(circle_id));

-- posts: viewer lee, no publica
create policy "posts_select_member" on public.posts
  for select using (public.is_circle_member(circle_id));
create policy "posts_insert_editor" on public.posts
  for insert with check (public.can_edit_circle(circle_id) and author_id = auth.uid());
create policy "posts_update_own" on public.posts
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "posts_delete_own_or_coordinator" on public.posts
  for delete using (author_id = auth.uid() or public.is_circle_coordinator(circle_id));

-- post_comments
create policy "comments_select_member" on public.post_comments
  for select using (exists (
    select 1 from public.posts p
    where p.id = post_id and public.is_circle_member(p.circle_id)
  ));
create policy "comments_insert_editor" on public.post_comments
  for insert with check (
    author_id = auth.uid() and exists (
      select 1 from public.posts p
      where p.id = post_id and public.can_edit_circle(p.circle_id)
    )
  );
create policy "comments_delete_own" on public.post_comments
  for delete using (author_id = auth.uid());

-- notifications: cada usuario las suyas
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- push_subscriptions
create policy "push_all_own" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- STORAGE: bucket privado "documents" ----------
-- Path obligatorio: circles/{circle_id}/...

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "docs_storage_select_member" on storage.objects
  for select using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'circles'
    and public.is_circle_member(((storage.foldername(name))[2])::uuid)
  );

create policy "docs_storage_insert_editor" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'circles'
    and public.can_edit_circle(((storage.foldername(name))[2])::uuid)
  );

create policy "docs_storage_delete_editor" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'circles'
    and public.can_edit_circle(((storage.foldername(name))[2])::uuid)
  );
