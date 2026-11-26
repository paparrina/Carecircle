"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { doseLogSchema, medicationSchema } from "@/lib/validators";

export type MedFormState = { error?: string } | null;

function parseMedForm(formData: FormData) {
  return medicationSchema.safeParse({
    circleId: formData.get("circleId"),
    name: formData.get("name"),
    dosage: formData.get("dosage"),
    instructions: formData.get("instructions") ?? "",
    times: formData.getAll("times").map(String),
    days: formData.getAll("days").map((d) => Number(d)),
    assignedTo: formData.get("assignedTo") ?? ""
  });
}

async function saveMedication(
  medicationId: string | null,
  formData: FormData
): Promise<MedFormState> {
  const parsed = parseMedForm(formData);
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: savedId, error } = await supabase.rpc("save_medication_with_schedules", {
    p_circle_id: d.circleId,
    p_medication_id: medicationId,
    p_name: d.name,
    p_dosage: d.dosage,
    p_instructions: d.instructions || null,
    p_assigned_to: d.assignedTo || null,
    p_times: d.times,
    p_days: d.days
  });
  if (error || !savedId) return { error: "generic" };

  revalidatePath(`/app/${d.circleId}`, "layout");
  redirect(medicationId ? `/app/${d.circleId}/meds/${savedId}` : `/app/${d.circleId}/meds`);
}

export async function createMedication(
  _prev: MedFormState,
  formData: FormData
): Promise<MedFormState> {
  return saveMedication(null, formData);
}

export async function updateMedication(
  medicationId: string,
  _prev: MedFormState,
  formData: FormData
): Promise<MedFormState> {
  return saveMedication(medicationId, formData);
}

export async function setMedicationActive(
  circleId: string,
  medicationId: string,
  active: boolean
) {
  const supabase = await createClient();
  await supabase
    .from("medications")
    .update({ active })
    .eq("id", medicationId)
    .eq("circle_id", circleId)
    .is("archived_at", null);
  revalidatePath(`/app/${circleId}`, "layout");
}

export async function archiveMedication(circleId: string, medicationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medications")
    .update({ active: false, archived_at: new Date().toISOString() })
    .eq("id", medicationId)
    .eq("circle_id", circleId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "generic" };
  revalidatePath(`/app/${circleId}`, "layout");
  redirect(`/app/${circleId}/meds?tab=all`);
}

/**
 * Registra una toma (dada u omitida). Devuelve el id del log para poder deshacer.
 *
 * Antes usaba `upsert` sobre (schedule_id, due_date): si dos personas registraban la
 * misma toma casi a la vez (o una pantalla desactualizada volvía a enviarla), la segunda
 * escritura sobrescribía en silencio el autor y el estado de la primera, perdiendo el
 * registro real de quién la dio. Ahora se inserta sin sobrescribir: si ya existe un
 * registro para esa toma, se devuelve "conflict" para que la interfaz avise y refresque
 * en vez de pisar el dato de otra persona.
 */
export async function logDose(input: {
  circleId: string;
  scheduleId: string;
  medicationId: string;
  dueDate: string;
  status: "taken" | "skipped";
}): Promise<{ logId?: string; error?: "invalid" | "auth" | "generic" | "conflict" }> {
  const parsed = doseLogSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };

  const { data, error } = await supabase
    .from("medication_logs")
    .insert({
      schedule_id: d.scheduleId,
      medication_id: d.medicationId,
      circle_id: d.circleId,
      due_date: d.dueDate,
      status: d.status,
      logged_by: user.id,
      logged_at: new Date().toISOString()
    })
    .select("id")
    .single();
  if (error) {
    // 23505 = unique_violation en (schedule_id, due_date): ya registrada por otra persona.
    if (error.code === "23505") return { error: "conflict" };
    return { error: "generic" };
  }
  if (!data) return { error: "generic" };

  revalidatePath(`/app/${d.circleId}`, "layout");
  return { logId: data.id };
}

export async function undoDose(circleId: string, logId: string) {
  const supabase = await createClient();
  await supabase.from("medication_logs").delete().eq("id", logId);
  revalidatePath(`/app/${circleId}`, "layout");
}
