-- The server-only email function needs explicit permissions on new projects.
grant select on public.notifications to service_role;
grant update (email_sent_at) on public.notifications to service_role;
