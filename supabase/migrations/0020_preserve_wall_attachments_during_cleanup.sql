begin;

create index posts_attachments_path_idx on public.posts using gin (attachments jsonb_path_ops);

create function carecircle_private.wall_attachment_referenced(p_path text)
returns boolean language sql stable set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
    where p.circle_id::text = split_part(p_path, '/', 2)
      and p.attachments @> jsonb_build_array(jsonb_build_object('storage_path', p_path))
  )
$$;
revoke execute on function carecircle_private.wall_attachment_referenced(text)
  from public, anon, authenticated, service_role;

create function public.posts_guard_attachment_cleanup()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_path text;
begin
  if jsonb_typeof(new.attachments) is distinct from 'array' then
    raise exception 'invalid_post_attachments';
  end if;
  for v_path in
    select distinct value->>'storage_path'
    from jsonb_array_elements(new.attachments)
    where value->>'storage_path' is not null
    order by 1
  loop
    if split_part(v_path, '/', 1) <> 'circles' or split_part(v_path, '/', 2) <> new.circle_id::text then
      raise exception 'invalid_wall_attachment_path';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_path, 7351));
    if exists (select 1 from public.document_upload_cleanup c where c.storage_path = v_path) then
      raise exception 'wall_attachment_upload_expired';
    end if;
  end loop;
  return new;
end;
$$;
create trigger posts_guard_attachment_cleanup
before insert or update of attachments on public.posts
for each row execute function public.posts_guard_attachment_cleanup();
revoke execute on function public.posts_guard_attachment_cleanup() from public, anon, authenticated;

create or replace function public.claim_abandoned_document_uploads()
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
      and not carecircle_private.wall_attachment_referenced(o.name)
    order by o.created_at, o.name
    limit 50
  loop
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(v_path, 7351)) then
      continue;
    end if;

    -- Recheck after the lock: an upload may have been attached since selection.
    if exists (select 1 from public.documents d where d.storage_path = v_path)
       or carecircle_private.wall_attachment_referenced(v_path) then
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

commit;
