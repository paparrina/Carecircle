begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000071','beta-settings-a@example.test'),
  ('00000000-0000-0000-0000-000000000072','beta-settings-b@example.test');
insert into public.notifications (id, user_id, type, payload)
values ('00000000-0000-0000-0000-000000000073','00000000-0000-0000-0000-000000000071','event_reminder','{}');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000071',true);
set local role authenticated;
insert into public.notification_preferences (user_id, email_enabled, push_enabled)
values (auth.uid(), false, true);
insert into public.push_subscriptions (user_id, endpoint, keys)
values (auth.uid(),'https://fcm.googleapis.com/fcm/send/carecircle-sql-test',
  jsonb_build_object('p256dh',repeat('A',87),'auth',repeat('B',22)));

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000072',true);
do $$
begin
  if exists (select 1 from public.notification_preferences) or exists (select 1 from public.push_subscriptions) then
    raise exception 'User can read another users notification settings';
  end if;
  if has_function_privilege(current_user,'public.claim_notification_pushes()','EXECUTE') then
    raise exception 'Ordinary user can claim push deliveries';
  end if;
  if not public.delete_empty_account() then raise exception 'Empty account was not deleted'; end if;
end
$$;

set local role service_role;
do $$
declare
  notification uuid := '00000000-0000-0000-0000-000000000073';
  delivery record;
begin
  if exists (select 1 from public.pending_notification_emails() where id = notification) then
    raise exception 'Email preference was ignored';
  end if;
  select * into strict delivery from public.claim_notification_pushes() where notification_id = notification;
  if delivery.attempts <> 1 or not public.can_send_notification_push(notification, delivery.subscription_id, delivery.lease) then
    raise exception 'First push was not eligible';
  end if;
  if exists (select 1 from public.claim_notification_pushes() where notification_id = notification) then
    raise exception 'Already leased push was claimed again';
  end if;
  update public.push_deliveries set next_attempt_at = now() - interval '1 second' where notification_id = notification;
  select * into strict delivery from public.claim_notification_pushes() where notification_id = notification;
  if delivery.attempts <> 2 then raise exception 'Retry was not claimed'; end if;
  update public.push_deliveries set finished = true where notification_id = notification;
  if public.can_send_notification_push(notification, delivery.subscription_id, delivery.lease) or
     exists (select 1 from public.claim_notification_pushes() where notification_id = notification) then
    raise exception 'Completed push can be sent again';
  end if;
end
$$;

set local role postgres;
insert into public.care_circles (id, name)
values ('00000000-0000-0000-0000-000000000074','Private beta SQL fixture');
insert into public.circle_members (circle_id, user_id, role) values
 ('00000000-0000-0000-0000-000000000074','00000000-0000-0000-0000-000000000071','coordinator');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000071',true);
set local role authenticated;
do $$
begin
  if public.delete_empty_account() then raise exception 'Account with shared data was deleted'; end if;
end
$$;
rollback;
