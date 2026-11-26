begin;

create table public.document_content_validations (
  storage_path text primary key,
  object_id uuid not null,
  object_version text not null,
  validated_by uuid not null,
  expires_at timestamptz not null
);
alter table public.document_content_validations enable row level security;
revoke all on public.document_content_validations from public, anon, authenticated, service_role;
create index document_content_validations_expires_at_idx
  on public.document_content_validations (expires_at);

create function public.inspect_document_upload(p_path text, p_user uuid)
returns table (object_id uuid, object_version text, mime_type text, size_bytes bigint)
language sql stable security definer set search_path = ''
as $$
  select o.id, o.version, lower(o.metadata->>'mimetype'), (o.metadata->>'size')::bigint
  from storage.objects o
  join public.circle_members cm
    on cm.circle_id::text = split_part(o.name, '/', 2) and cm.user_id = p_user
  where o.bucket_id = 'documents' and o.name = p_path
    and split_part(o.name, '/', 1) = 'circles'
    and cm.role in ('coordinator', 'member')
    and o.owner_id = p_user::text
    and o.version is not null
$$;

create function public.confirm_document_content_validation(
  p_path text, p_user uuid, p_object_id uuid, p_object_version text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_path, 7351));

  if not exists (
    select 1 from public.inspect_document_upload(p_path, p_user) o
    where o.object_id = p_object_id and o.object_version = p_object_version
  ) or exists (
    select 1 from public.document_upload_cleanup c where c.storage_path = p_path
  ) or exists (
    select 1 from public.documents d where d.storage_path = p_path
  ) then
    return false;
  end if;

  delete from public.document_content_validations where expires_at <= now();
  insert into public.document_content_validations (
    storage_path, object_id, object_version, validated_by, expires_at
  ) values (p_path, p_object_id, p_object_version, p_user, now() + interval '15 minutes')
  on conflict (storage_path) do update set
    object_id = excluded.object_id,
    object_version = excluded.object_version,
    validated_by = excluded.validated_by,
    expires_at = excluded.expires_at;
  return true;
end;
$$;

revoke execute on function public.inspect_document_upload(text, uuid) from public, anon, authenticated;
revoke execute on function public.confirm_document_content_validation(text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.inspect_document_upload(text, uuid) to service_role;
grant execute on function public.confirm_document_content_validation(text, uuid, uuid, text) to service_role;

create function public.documents_require_content_validation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Runs after documents_guard_cleanup, under the same path lock.
  delete from public.document_content_validations v using storage.objects o
  where v.storage_path = new.storage_path and v.validated_by = auth.uid()
    and v.expires_at > now()
    and o.bucket_id = 'documents' and o.name = new.storage_path
    and o.id = v.object_id and o.version = v.object_version;
  if not found then
    raise exception 'document_content_not_validated';
  end if;
  return new;
end;
$$;
create trigger documents_verify_validated_content
before insert on public.documents
for each row execute function public.documents_require_content_validation();
revoke execute on function public.documents_require_content_validation() from public, anon, authenticated;

-- A new upload may not replace the validated content of an existing document.
create or replace function carecircle_private.document_upload_path_is_open(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.document_upload_cleanup c where c.storage_path = p_path
  ) and not exists (
    select 1 from public.documents d where d.storage_path = p_path
  )
$$;

commit;
