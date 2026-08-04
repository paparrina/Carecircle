"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { eventSchema } from "@/lib/validators";
import { madridToUTC } from "@/lib/dates";

export type EventFormState = { error?: string } | null;

function parseEventForm(formData: FormData) {
  return eventSchema.safeParse({
    circleId: formData.get("circleId"),
    title: formData.get("title"),
    type: formData.get("type"),
    date: formData.get("date"),
    time: formData.get("time"),
    endTime: formData.get("endTime") ?? "",
    location: formData.get("location") ?? "",
    notes: formData.get("notes") ?? "",
    assignedTo: formData.get("assignedTo") ?? "",
    reminders: formData.getAll("reminders").map(String)
  });
}

function toRow(d: ReturnType<typeof parseEventForm>["data"] & object) {
  const x = d as import("zod").infer<typeof eventSchema>;
  return {
    title: x.title,
    type: x.type,
    starts_at: madridToUTC(x.date, x.time),
    ends_at: x.endTime ? madridToUTC(x.date, x.endTime) : null,
    location: x.location || null,
    notes: x.notes || null,
    assigned_to: x.assignedTo || null,
    reminder_minutes: x.reminders
  };
}

export async function createEvent(
  _prev: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const parsed = parseEventForm(formData);
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };

  const { error } = await supabase.from("events").insert({
    circle_id: parsed.data.circleId,
    created_by: user.id,
    ...toRow(parsed.data)
  });
  if (error) return { error: "generic" };

  revalidatePath(`/app/${parsed.data.circleId}`, "layout");
  redirect(`/app/${parsed.data.circleId}/calendar`);
}

export async function updateEvent(
  eventId: string,
  _prev: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const parsed = parseEventForm(formData);
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update(toRow(parsed.data))
    .eq("id", eventId);
  if (error) return { error: "generic" };

  revalidatePath(`/app/${parsed.data.circleId}`, "layout");
  redirect(`/app/${parsed.data.circleId}/calendar/${eventId}`);
}

export async function setEventCompleted(
  circleId: string,
  eventId: string,
  completed: boolean
) {
  const supabase = await createClient();
  await supabase
    .from("events")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", eventId);
  revalidatePath(`/app/${circleId}`, "layout");
}

export async function deleteEvent(circleId: string, eventId: string) {
  const supabase = await createClient();
  await supabase.from("events").delete().eq("id", eventId);
  revalidatePath(`/app/${circleId}`, "layout");
  redirect(`/app/${circleId}/calendar`);
}
