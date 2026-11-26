-- Run with migrations through 0018. The fixtures are rolled back.
begin;
insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-000000000051','validator@example.test'),
  ('00000000-0000-0000-0000-000000000052','other-validator@example.test');
insert into public.care_circles(id,name)
values ('00000000-0000-0000-0000-000000000053','Validation fixture');
insert into public.circle_members(circle_id,user_id,role)
values ('00000000-0000-0000-0000-000000000053','00000000-0000-0000-0000-000000000051','coordinator');
insert into storage.objects(id,bucket_id,name,metadata,owner_id,version)
values ('00000000-0000-0000-0000-000000000054','documents',
  'circles/00000000-0000-0000-0000-000000000053/fixture.pdf',
  '{"size":42,"mimetype":"application/pdf"}','00000000-0000-0000-0000-000000000051','actual-version');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000051',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000051"}',true);

do $$
begin
  if has_function_privilege(current_user,'public.confirm_document_content_validation(text,uuid,uuid,text)','EXECUTE') then
    raise exception 'Users can issue validation records';
  end if;
  begin
    insert into public.documents (circle_id,name,storage_path,uploaded_by)
    values ('00000000-0000-0000-0000-000000000053','Fixture PDF',
      'circles/00000000-0000-0000-0000-000000000053/fixture.pdf',auth.uid());
    raise exception 'File without content validation was registered';
  exception when raise_exception then
    if sqlerrm <> 'document_content_not_validated' then raise; end if;
  end;
end $$;

set local role service_role;
do $$
declare
  v_path text := 'circles/00000000-0000-0000-0000-000000000053/fixture.pdf';
  v_user uuid := '00000000-0000-0000-0000-000000000051';
  v_object uuid := '00000000-0000-0000-0000-000000000054';
begin
  if public.confirm_document_content_validation(v_path,v_user,v_object,'stale-version')
     or public.confirm_document_content_validation(v_path,'00000000-0000-0000-0000-000000000052',v_object,'actual-version') then
    raise exception 'Invalid file validation was accepted';
  end if;
  if not public.confirm_document_content_validation(v_path,v_user,v_object,'actual-version') then
    raise exception 'Valid file validation rejected';
  end if;
end $$;

set local role authenticated;
insert into public.documents (circle_id,name,storage_path,uploaded_by)
values ('00000000-0000-0000-0000-000000000053','Fixture PDF',
  'circles/00000000-0000-0000-0000-000000000053/fixture.pdf',auth.uid());

do $$
begin
  if carecircle_private.document_upload_path_is_open('circles/00000000-0000-0000-0000-000000000053/fixture.pdf') then
    raise exception 'Registered document path is open for replacement';
  end if;
end $$;

reset role;
do $$
begin
  if exists (select from public.document_content_validations where object_id='00000000-0000-0000-0000-000000000054') then
    raise exception 'Validation was not consumed on registration';
  end if;
end $$;

rollback;
