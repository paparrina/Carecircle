"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function deleteAccount(
  _previous: boolean | null,
  formData: FormData
): Promise<boolean | null> {
  if (formData.get("confirm") !== "on") return false;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.rpc("delete_empty_account");
  if (error || data !== true) return false;
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?accountDeleted=1");
}
