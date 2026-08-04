-- =============================================================
-- Cerca · 0002_meds_profile.sql (Tarea 2)
-- Teléfono de la persona cuidada + deshacer registro de tomas
-- =============================================================

alter table public.care_recipients add column if not exists phone text;

-- Deshacer una toma = borrar el registro (propio, o cualquiera si eres editor)
create policy "med_logs_delete_own_or_editor" on public.medication_logs
  for delete using (
    logged_by = auth.uid() or public.can_edit_circle(circle_id)
  );
