"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkinSchema, newCircleSchema } from "@/lib/validators";

export type ActionState = { error?: string } | null;

export async function createCircle(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = newCircleSchema.safeParse({
    recipientName: formData.get("recipientName"),
    birthYear: formData.get("birthYear") ?? "",
    consent: formData.get("consent")
  });
  if (!parsed.success) return { error: "invalid" };

  const birthDate =
    typeof parsed.data.birthYear === "number"
      ? `${parsed.data.birthYear}-01-01`
      : null;

  const supabase = await createClient();
  const { data: circleId, error } = await supabase.rpc(
    "create_circle_with_recipient",
    { p_recipient_name: parsed.data.recipientName, p_birth_date: birthDate }
  );
  if (error || !circleId) return { error: "generic" };

  revalidatePath("/app", "layout");
  redirect(`/app/${circleId}/welcome`);
}

export async function logCheckin(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = checkinSchema.safeParse({
    circleId: formData.get("circleId"),
    place: formData.get("place"),
    placeLabel: (formData.get("placeLabel") as string) || undefined
  });
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };

  const { error } = await supabase.from("location_checkins").insert({
    circle_id: parsed.data.circleId,
    place: parsed.data.place,
    place_label: parsed.data.place === "other" ? parsed.data.placeLabel : null,
    checked_by: user.id
  });
  if (error) return { error: "generic" };

  revalidatePath(`/app/${parsed.data.circleId}`, "layout");
  return null;
}

export async function updateRecipient(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { recipientSchema } = await import("@/lib/validators");
  const raw = {
    circleId: formData.get("circleId"),
    fullName: formData.get("fullName"),
    birthDate: formData.get("birthDate") ?? "",
    phone: formData.get("phone") ?? "",
    allergies: formData.get("allergies") ?? "",
    conditions: formData.get("conditions") ?? "",
    notes: formData.get("notes") ?? "",
    contacts: JSON.parse((formData.get("contacts") as string) || "[]"),
    doctors: JSON.parse((formData.get("doctors") as string) || "[]")
  };
  const parsed = recipientSchema.safeParse(raw);
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const toArray = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 20);

  const supabase = await createClient();
  const { error } = await supabase
    .from("care_recipients")
    .update({
      full_name: d.fullName,
      birth_date: d.birthDate || null,
      phone: d.phone || null,
      allergies: toArray(d.allergies),
      conditions: toArray(d.conditions),
      notes: d.notes || null,
      emergency_contacts: d.contacts,
      doctors: d.doctors
    })
    .eq("circle_id", d.circleId);
  if (error) return { error: "generic" };

  revalidatePath(`/app/${d.circleId}`, "layout");
  return null;
}
