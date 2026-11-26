begin;

create table public.document_upload_cleanup (
  storage_path text primary key,
  retry_after timestamptz not null
);
alter table public.document_upload_cleanup enable row level security;
revoke all on public.document_upload_cleanup from public, anon, authenticated, service_role;

-- Coordinate registration and cleanup at the same storage path. Once claimed,
-- a path cannot be attached even if Storage deletion needs a retry.
create function public.documents_guard_cleanup()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.storage_path, 7351));
  if exists (
    select 1 from public.document_upload_cleanup c where c.storage_path = new.storage_path
  ) then
    raise exception 'document_upload_expired';
  end if;
  return new;
end;
$$;
create trigger documents_guard_cleanup
before insert on public.documents
for each row execute function public.documents_guard_cleanup();
revoke execute on function public.documents_guard_cleanup() from public, anon, authenticated;

-- A client retry may not overwrite the path while the worker owns its lease.
create schema if not exists carecircle_private;
grant usage on schema carecircle_private to authenticated;
create function carecircle_private.document_upload_path_is_open(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.document_upload_cleanup c where c.storage_path = p_path
  )
$$;
revoke execute on function carecircle_private.document_upload_path_is_open(text) from public, anon;
grant execute on function carecircle_private.document_upload_path_is_open(text) to authenticated;
create policy documents_storage_claimed_paths
on storage.objects as restrictive for insert to authenticated
with check (bucket_id <> 'documents' or carecircle_private.document_upload_path_is_open(name));

create function public.claim_abandoned_document_uploads()
returns setof text
language plpgsql security definer set search_path = ''
as $$
declare
  v_path text;
begin
  -- Storage is removed through its API. A missing object confirms a prior
  -- deletion even if the worker stopped before receiving its response.
  delete from public.document_upload_cleanup c where not exists (
    select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = c.storage_path
  );

  for v_path in
    select o.name from storage.objects o
    left join public.document_upload_cleanup c on c.storage_path = o.name
    where o.bucket_id = 'documents'
      and o.name like 'circles/%'
      and o.created_at <= now() - interval '24 hours'
      and (c.retry_after is null or c.retry_after <= now())
      and not exists (select 1 from public.documents d where d.storage_path = o.name)
    order by o.created_at, o.name
    limit 50
  loop
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(v_path, 7351)) then
      continue;
    end if;

    -- Recheck after the lock: an upload may have been attached since selection.
    if exists (select 1 from public.documents d where d.storage_path = v_path) then
      continue;
    end if;
    insert into public.document_upload_cleanup (storage_path, retry_after)
    values (v_path, now() + interval '15 minutes')
    on conflict (storage_path) do update set retry_after = excluded.retry_after
      where document_upload_cleanup.retry_after <= now();
    if found then return next v_path; end if;
  end loop;
end;
$$;
revoke execute on function public.claim_abandoned_document_uploads() from public, anon, authenticated;
grant execute on function public.claim_abandoned_document_uploads() to service_role;

commit;
