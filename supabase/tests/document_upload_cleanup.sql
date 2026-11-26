-- Run in the test project or disposable PostgreSQL with migrations through 0018.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000041', 'cleanup@example.test');
insert into public.care_circles (id, name) values
  ('00000000-0000-0000-0000-000000000042', 'Cleanup fixture');
insert into public.circle_members (circle_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000041', 'coordinator');
insert into storage.objects (bucket_id, name, metadata, created_at)
select 'documents', 'circles/00000000-0000-0000-0000-000000000042/' || path,
  '{"size":42,"mimetype":"application/pdf"}', now() - age
from (values ('old.pdf', interval '25 hours'), ('fresh.pdf', interval '1 hour'),
  ('registered.pdf', interval '25 hours')) examples(path, age);

update storage.objects set version='fixture-version'
where name='circles/00000000-0000-0000-0000-000000000042/registered.pdf';
insert into public.document_content_validations (storage_path,object_id,object_version,validated_by,expires_at)
select name,id,version,'00000000-0000-0000-0000-000000000041',now()+interval '10 minutes'
from storage.objects where name='circles/00000000-0000-0000-0000-000000000042/registered.pdf';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000041', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000041"}', true);
insert into public.documents (circle_id, name, storage_path, uploaded_by)
values ('00000000-0000-0000-0000-000000000042', 'Registered fixture',
  'circles/00000000-0000-0000-0000-000000000042/registered.pdf', auth.uid());

do $$
begin
  if has_function_privilege(current_user, 'public.claim_abandoned_document_uploads()', 'EXECUTE') then
    raise exception 'Normal user can claim abandoned uploads';
  end if;
end $$;

set local role service_role;
do $$
declare
  v_prefix text := 'circles/00000000-0000-0000-0000-000000000042/';
  v_claimed text[];
begin
  select array_agg(path order by path) into v_claimed
  from public.claim_abandoned_document_uploads() path where path like v_prefix || '%';
  if v_claimed is distinct from array[v_prefix || 'old.pdf'] then
    raise exception 'Cleanup claimed unexpected paths';
  end if;
  if exists (select 1 from public.claim_abandoned_document_uploads() path where path like v_prefix || '%') then
    raise exception 'A second worker acquired paths before the lease expired';
  end if;
end $$;

set local role authenticated;
do $$
begin
  begin
    insert into public.documents (circle_id, name, storage_path, uploaded_by)
    values ('00000000-0000-0000-0000-000000000042', 'Late registration',
      'circles/00000000-0000-0000-0000-000000000042/old.pdf', auth.uid());
    raise exception 'An upload claimed for cleanup was attached';
  exception when raise_exception then
    if sqlerrm <> 'document_upload_expired' then raise; end if;
  end;
end $$;

rollback;
