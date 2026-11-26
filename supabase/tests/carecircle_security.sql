-- Run on a disposable database with migrations through 0018, using the SQL editor
-- or psql -v ON_ERROR_STOP=1. Fixtures and changes are rolled back.
begin;
insert into auth.users (id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-000000000021','coordinator@example.test',now()),
 ('00000000-0000-0000-0000-000000000022','member@example.test',now()),
 ('00000000-0000-0000-0000-000000000023','viewer@example.test',now()),
 ('00000000-0000-0000-0000-000000000024','other@example.test',now());
insert into public.care_circles (id,name) values
 ('00000000-0000-0000-0000-000000000025','Fixture one'),
 ('00000000-0000-0000-0000-000000000026','Fixture two');
insert into public.circle_members (circle_id,user_id,role) values
 ('00000000-0000-0000-0000-000000000025','00000000-0000-0000-0000-000000000021','coordinator'),
 ('00000000-0000-0000-0000-000000000025','00000000-0000-0000-0000-000000000022','member'),
 ('00000000-0000-0000-0000-000000000025','00000000-0000-0000-0000-000000000023','viewer'),
 ('00000000-0000-0000-0000-000000000026','00000000-0000-0000-0000-000000000024','coordinator');
insert into public.medications (id,circle_id,name,dosage,created_at) values
 ('00000000-0000-0000-0000-000000000027','00000000-0000-0000-0000-000000000025','Fixture medication','One unit',now()-interval '3 days');
alter table public.medication_schedules disable trigger medication_schedule_preserve_version;
insert into public.medication_schedules (id,medication_id,time_of_day,effective_at) values
 ('00000000-0000-0000-0000-000000000028','00000000-0000-0000-0000-000000000027','10:00',now()-interval '2 days'),
 ('00000000-0000-0000-0000-000000000029','00000000-0000-0000-0000-000000000027',
 ((now() at time zone 'Europe/Madrid') - interval '100 minutes')::time,now()-interval '2 days');
alter table public.medication_schedules enable trigger medication_schedule_preserve_version;
update public.medications set assigned_to='00000000-0000-0000-0000-000000000022'
where id='00000000-0000-0000-0000-000000000027';
select public.run_notification_sweep();
do $$
begin
  if (now() at time zone 'Europe/Madrid')::time >= time '01:40' and (
    not exists (select from public.notifications where user_id='00000000-0000-0000-0000-000000000022'
      and dedup_key like 'med:00000000-0000-0000-0000-000000000029:%:45:%') or
    not exists (select from public.notifications where user_id='00000000-0000-0000-0000-000000000021'
      and dedup_key like 'med:00000000-0000-0000-0000-000000000029:%:90:%')
  ) then raise exception 'Expected reminder or escalation missing'; end if;
end $$;
insert into public.invitations (circle_id,token,role) values
 ('00000000-0000-0000-0000-000000000025','fixture-old-invite','member');
insert into storage.objects (bucket_id,name,metadata) values
 ('documents','circles/00000000-0000-0000-0000-000000000025/fixture.pdf','{"size":42,"mimetype":"application/pdf"}'),
 ('documents','circles/00000000-0000-0000-0000-000000000025/large.pdf','{"size":20971521,"mimetype":"application/pdf"}'),
 ('documents','circles/00000000-0000-0000-0000-000000000025/invalid.svg','{"size":42,"mimetype":"image/svg+xml"}');

insert into public.document_content_validations (storage_path,object_id,object_version,validated_by,expires_at)
select name,id,'fixture-version','00000000-0000-0000-0000-000000000021',now()+interval '10 minutes'
from storage.objects where name='circles/00000000-0000-0000-0000-000000000025/fixture.pdf';
update storage.objects set version='fixture-version'
where name='circles/00000000-0000-0000-0000-000000000025/fixture.pdf';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000021"}',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',true);
insert into public.documents(circle_id,name,storage_path,sensitive,uploaded_by)
values ('00000000-0000-0000-0000-000000000025','Fixture PDF',
 'circles/00000000-0000-0000-0000-000000000025/fixture.pdf',true,auth.uid());

do $$
declare
  v_file text;
begin
  foreach v_file in array array['large.pdf','invalid.svg','absent.pdf'] loop
    begin
      insert into public.documents(circle_id,name,storage_path,uploaded_by)
      values ('00000000-0000-0000-0000-000000000025',v_file,
        'circles/00000000-0000-0000-0000-000000000025/' || v_file,auth.uid());
      raise exception 'Invalid document was accepted';
    exception when raise_exception then
      if sqlerrm <> 'invalid_document_storage' then raise; end if;
    end;
  end loop;
end $$;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000023"}',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000023',true);
do $$
declare
  v_date date := (now() at time zone 'Europe/Madrid')::date;
  v_schedule uuid := '00000000-0000-0000-0000-000000000028';
  offset_days integer;
begin
  if exists(select 1 from public.documents where name='Fixture PDF')
     or exists(select 1 from storage.objects where name like '%/fixture.pdf')
     or exists(select 1 from public.care_circles where name='Fixture two') then
    raise exception 'Viewer sees restricted data';
  end if;
  insert into public.medication_logs(schedule_id,due_date,status,logged_by)
  values (v_schedule,v_date-1,'taken',auth.uid());
  begin
    insert into public.medication_logs(schedule_id,due_date,status,logged_by)
    values (v_schedule,v_date-1,'skipped',auth.uid());
    raise exception 'Duplicate was accepted';
  exception when unique_violation then null;
  end;
  foreach offset_days in array array[-2,1] loop
    begin
      insert into public.medication_logs(schedule_id,due_date,status,logged_by)
      values (v_schedule,v_date+offset_days,'taken',auth.uid());
      raise exception 'Unexpected date was accepted';
    exception when raise_exception then
      if sqlerrm <> 'invalid_medication_occurrence' then raise; end if;
    end;
  end loop;
  update public.medication_logs set status='skipped' where schedule_id=v_schedule;
  if not exists(select 1 from public.medication_log_corrections
     where schedule_id=v_schedule and previous_status='taken' and corrected_status='skipped') then
    raise exception 'Correction history missing';
  end if;
end $$;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000024"}',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000024',true);
do $$
begin
  if exists (select 1 from public.medications where name='Fixture medication')
     or exists (select 1 from public.medication_log_corrections
       where schedule_id='00000000-0000-0000-0000-000000000028')
     or exists (select 1 from public.documents where name='Fixture PDF') then
    raise exception 'Other circle coordinator sees restricted data';
  end if;
end $$;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000021"}',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',true);
select public.save_medication_with_schedules(
  '00000000-0000-0000-0000-000000000025','00000000-0000-0000-0000-000000000027',
  'Fixture medication','One unit',null,null,array[time '12:00'],array[1,3,5]);
do $$
begin
  if not exists (
    select 1 from public.medication_schedules s join public.medication_logs l on l.schedule_id=s.id
    where s.id='00000000-0000-0000-0000-000000000028'
      and s.retired_at is not null and s.time_of_day=time '10:00'
  ) then raise exception 'Schedule edit lost the old version or its log'; end if;
end $$;

reset role;
delete from public.circle_members where user_id='00000000-0000-0000-0000-000000000022';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000022"}',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000022',true);
do $$
begin
  if exists (select 1 from public.notifications where type='doc_uploaded') then
    raise exception 'Former member can read document notice';
  end if;
  begin
    perform public.accept_invitation('fixture-old-invite');
    raise exception 'Former member rejoined with an old invitation';
  exception when raise_exception then
    if sqlerrm <> 'invitation_invalid_or_expired' then raise; end if;
  end;
end $$;

rollback;
