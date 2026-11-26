begin;

update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'image/heic', 'image/heif', 'application/msword', 'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
where id = 'documents';

create function public.documents_verify_storage_metadata()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_metadata jsonb;
  v_size bigint;
  v_type text;
begin
  if not public.can_edit_circle(new.circle_id)
     or split_part(new.storage_path, '/', 1) <> 'circles'
     or split_part(new.storage_path, '/', 2) <> new.circle_id::text then
    raise exception 'invalid_document_storage';
  end if;
  select o.metadata into v_metadata from storage.objects o
  where o.bucket_id = 'documents' and o.name = new.storage_path;
  v_size := (v_metadata->>'size')::bigint;
  v_type := lower(v_metadata->>'mimetype');
  if v_size is null or v_size not between 1 and 20971520
     or v_type is null or not exists (
       select 1 from storage.buckets where id = 'documents' and v_type = any(allowed_mime_types)
     ) then
    raise exception 'invalid_document_storage';
  end if;
  new.size_bytes := v_size;
  new.mime_type := v_type;
  return new;
end;
$$;

create trigger documents_verify_storage_metadata
before insert on public.documents
for each row execute function public.documents_verify_storage_metadata();
revoke execute on function public.documents_verify_storage_metadata() from public, anon, authenticated;

commit;
