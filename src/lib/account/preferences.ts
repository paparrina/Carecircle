"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveEmailPreference(enabled: boolean): Promise<boolean> {
  if (typeof enabled !== "boolean") return false;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: user.id,
    email_enabled: enabled
  });
  if (error) return false;
  revalidatePath("/account");
  return true;
}
