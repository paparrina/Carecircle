"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { importantDateSchema } from "@/lib/validators";

export async function createImportantDate(
  input: z.infer<typeof importantDateSchema>
): Promise<{ error?: string }> {
  const parsed = importantDateSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };

  const { error } = await supabase.from("important_dates").insert({
    circle_id: d.circleId,
    title: d.title,
    date: d.date,
    type: d.type,
    recurring: d.recurring,
    remind_days_before: d.remindDaysBefore,
    created_by: user.id
  });
  if (error) return { error: "generic" };

  revalidatePath(`/app/${d.circleId}`, "layout");
  return {};
}

export async function deleteImportantDate(circleId: string, id: string) {
  const supabase = await createClient();
  await supabase.from("important_dates").delete().eq("id", id);
  revalidatePath(`/app/${circleId}`, "layout");
}
