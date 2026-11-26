begin;

create table public.circle_membership_revocations (
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  user_id uuid not null,
  revoked_at timestamptz not null,
  primary key (circle_id, user_id)
);
alter table public.circle_membership_revocations enable row level security;

create or replace function public.circle_members_prevent_zero_coordinators()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (new.circle_id, new.user_id) is distinct from (old.circle_id, old.user_id) then
      raise exception 'circle_membership_identity_is_immutable';
    end if;
    if old.role <> 'coordinator' or new.role = 'coordinator' then return new; end if;
  end if;

  -- Update the parent row as a serialization point, including at stronger
  -- isolation levels. A cascading circle deletion has no parent left to guard.
  if old.role = 'coordinator' then
    update public.care_circles set id = id where id = old.circle_id;
  else
    perform 1 from public.care_circles where id = old.circle_id for update;
  end if;
  if not found then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if old.role = 'coordinator' and not exists (
    select 1 from public.circle_members
    where circle_id = old.circle_id and role = 'coordinator' and id <> old.id
  ) then
    raise exception 'circle_requires_at_least_one_coordinator';
  end if;

  if tg_op = 'DELETE' then
    insert into public.circle_membership_revocations (circle_id, user_id, revoked_at)
    values (old.circle_id, old.user_id, clock_timestamp())
    on conflict (circle_id, user_id) do update set revoked_at = excluded.revoked_at;
    return old;
  end if;
  return new;
end;
$$;

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

  -- Serialize acceptance with removal, then read the invitation again.
  perform 1 from public.care_circles where id = v_inv.circle_id for update;
  select * into v_inv from public.invitations
  where token = p_token and accepted_at is null and expires_at > now();
  if not found or exists (
    select 1 from public.circle_membership_revocations r
    where r.circle_id = v_inv.circle_id and r.user_id = auth.uid()
      and r.revoked_at >= v_inv.created_at
  ) then
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


commit;
