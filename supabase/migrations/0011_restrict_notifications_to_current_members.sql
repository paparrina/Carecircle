begin;

-- Personal notifications remain visible. Circle notifications require current
-- membership, even if they were created before the member lost access.
alter policy notifications_select_own on public.notifications
  using (
    user_id = auth.uid()
    and (circle_id is null or public.is_circle_member(circle_id))
  );

alter policy notifications_update_own on public.notifications
  using (
    user_id = auth.uid()
    and (circle_id is null or public.is_circle_member(circle_id))
  )
  with check (
    user_id = auth.uid()
    and (circle_id is null or public.is_circle_member(circle_id))
  );

commit;
