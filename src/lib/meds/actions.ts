"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { doseLogSchema, medicationSchema } from "@/lib/validators";

export type MedFormState = { error?: string } | null;

async function saveSchedules(
  supabase: Awaited<ReturnType<typeof createClient>>,
  medicationId: string,
  times: string[],
  days: number[]
) {
  await supabase
    .from("medication_schedules")
    .delete()
    .eq("medication_id", medicationId);
  const rows = times.map((t) => ({
    medication_id: medicationId,
    time_of_day: t,
    days_of_week: days
  }));
  return supabase.from("medication_schedules").insert(rows);
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

/** Registra una toma (dada u omitida). Devuelve el id del log para poder deshacer. */
export async function logDose(input: {
  circleId: string;
  scheduleId: string;
  medicationId: string;
  dueDate: string;
  status: "taken" | "skipped";
}): Promise<{ logId?: string; error?: string }> {
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
    .upsert(
      {
        schedule_id: d.scheduleId,
        medication_id: d.medicationId,
        circle_id: d.circleId,
        due_date: d.dueDate,
        status: d.status,
        logged_by: user.id,
        logged_at: new Date().toISOString()
      },
      { onConflict: "schedule_id,due_date" }
    )
    .select("id")
    .single();
  if (error || !data) return { error: "generic" };

  revalidatePath(`/app/${d.circleId}`, "layout");
  return { logId: data.id };
}

export async function undoDose(circleId: string, logId: string) {
  const supabase = await createClient();
  await supabase.from("medication_logs").delete().eq("id", logId);
  revalidatePath(`/app/${circleId}`, "layout");
}
