"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function registerPush(subscription: PushSubscriptionJSON): Promise<boolean> {
  const { endpoint, keys } = subscription ?? {};
  if (typeof endpoint !== "string" || endpoint.length > 2048 ||
      typeof keys?.p256dh !== "string" || typeof keys.auth !== "string" ||
      !/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(keys.auth)) return false;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.port || url.username || url.password ||
        !["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(url.hostname)) return false;
  } catch { return false; }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }
  }, { onConflict: "endpoint" });
  if (error) return false;
  const preference = await supabase.from("notification_preferences").upsert({ user_id: user.id, push_enabled: true });
  if (preference.error) return false;
  revalidatePath("/account");
  return true;
}

export async function unregisterPush(endpoint: string): Promise<boolean> {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  return !error;
}

export async function disablePush(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("notification_preferences").upsert({ user_id: user.id, push_enabled: false });
  if (error) return false;
  await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  revalidatePath("/account");
  return true;
}
