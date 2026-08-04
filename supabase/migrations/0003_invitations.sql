-- =============================================================
-- Cerca · 0003_invitations.sql (Tarea 5)
-- Info pública (por token) de una invitación, para la página /invite
-- =============================================================

create or replace function public.get_invitation_info(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'valid', (i.accepted_at is null and i.expires_at > now()),
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

  return coalesce(v, jsonb_build_object('valid', false));
end;
$$;
