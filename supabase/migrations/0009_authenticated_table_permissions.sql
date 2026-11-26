-- New Supabase projects may not grant Data API roles access to public tables automatically.
-- Table privileges enable the operations below; RLS still checks each row.
begin;
grant usage on schema public to authenticated;
grant select on public.profiles, public.care_circles, public.care_recipients,
  public.circle_members, public.invitations, public.events, public.medications,
  public.medication_schedules, public.medication_logs, public.important_dates,
  public.location_checkins, public.document_folders, public.documents, public.posts,
  public.post_comments, public.notifications, public.push_subscriptions to authenticated;
grant insert on public.invitations, public.events, public.medications,
  public.medication_schedules, public.medication_logs, public.important_dates,
  public.location_checkins, public.document_folders, public.documents, public.posts,
  public.post_comments, public.push_subscriptions to authenticated;
grant update on public.profiles, public.care_circles, public.care_recipients,
  public.circle_members, public.invitations, public.events, public.medications,
  public.medication_schedules, public.medication_logs, public.important_dates,
  public.document_folders, public.documents, public.posts, public.push_subscriptions to authenticated;
grant delete on public.care_circles, public.circle_members, public.invitations,
  public.events, public.medications, public.medication_schedules, public.medication_logs,
  public.important_dates, public.document_folders, public.documents, public.posts,
  public.post_comments, public.push_subscriptions to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
commit;
