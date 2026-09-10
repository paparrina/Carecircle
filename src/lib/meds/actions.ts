"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { doseLogSchema, medicationSchema } from "@/lib/validators";

export type MedFormState = { error?: string } | null;

/**
 * Actualiza los horarios de un medicamento sin perder el historial de tomas.
 *
 * Un horario que se borra y vuelve a crear cambia de id, y `medication_logs.schedule_id`
 * tiene `on delete cascade`: borrar y recrear todos los horarios en cada edición
 * (incluida una edición que solo cambia el nombre o la dosis) borraba también los
 * registros de tomas ya hechas. En su lugar, se actualizan en el sitio los horarios
 * cuya hora se mantiene, y solo se borran/crean los que realmente cambian de hora.
 */
async function saveSchedules(
  supabase: Awaited<ReturnType<typeof createClient>>,
  medicationId: string,
  times: string[],
  days: number[]
) {
  const { data: existing, error: fetchErr } = await supabase
    .from("medication_schedules")
    .select("id, time_of_day")
    .eq("medication_id", medicationId);
  if (fetchErr) return { error: fetchErr };

  const normalize = (t: string) => t.slice(0, 5);
  const existingByTime = new Map(
    (existing ?? []).map((s) => [normalize(s.time_of_day as string), s.id as string])
  );
  const nextTimes = new Set(times.map(normalize));

  const idsToRemove = (existing ?? [])
    .filter((s) => !nextTimes.has(normalize(s.time_of_day as string)))
    .map((s) => s.id as string);
  if (idsToRemove.length > 0) {
    const { error } = await supabase
      .from("medication_schedules")
      .delete()
      .in("id", idsToRemove);
    if (error) return { error };
  }

  for (const t of times) {
    const existingId = existingByTime.get(normalize(t));
    const { error } = existingId
      ? await supabase
          .from("medication_schedules")
          .update({ days_of_week: days })
          .eq("id", existingId)
      : await supabase
          .from("medication_schedules")
          .insert({ medication_id: medicationId, time_of_day: t, days_of_week: days });
    if (error) return { error };
  }

  return { error: null };
}

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

export async function createMedication(
  _prev: MedFormState,
  formData: FormData
): Promise<MedFormState> {
  const parsed = parseMedForm(formData);
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };

  const { data: med, error } = await supabase
    .from("medications")
    .insert({
      circle_id: d.circleId,
      name: d.name,
      dosage: d.dosage,
      instructions: d.instructions || null,
      assigned_to: d.assignedTo || null,
      created_by: user.id
    })
    .select("id")
    .single();
  if (error || !med) return { error: "generic" };

  const { error: schedErr } = await saveSchedules(
    supabase,
    med.id,
    d.times,
    d.days
  );
  if (schedErr) return { error: "generic" };

  revalidatePath(`/app/${d.circleId}`, "layout");
  redirect(`/app/${d.circleId}/meds`);
}

export async function updateMedication(
  medicationId: string,
  _prev: MedFormState,
  formData: FormData
): Promise<MedFormState> {
  const parsed = parseMedForm(formData);
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("medications")
    .update({
      name: d.name,
      dosage: d.dosage,
      instructions: d.instructions || null,
      assigned_to: d.assignedTo || null
    })
    .eq("id", medicationId);
  if (error) return { error: "generic" };

  const { error: schedErr } = await saveSchedules(
    supabase,
    medicationId,
    d.times,
    d.days
  );
  if (schedErr) return { error: "generic" };

  revalidatePath(`/app/${d.circleId}`, "layout");
  redirect(`/app/${d.circleId}/meds/${medicationId}`);
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
    .eq("id", medicationId);
  revalidatePath(`/app/${circleId}`, "layout");
}

export async function deleteMedication(circleId: string, medicationId: string) {
  const supabase = await createClient();
  await supabase.from("medications").delete().eq("id", medicationId);
  revalidatePath(`/app/${circleId}`, "layout");
  redirect(`/app/${circleId}/meds`);
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
