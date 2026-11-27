import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Delivery = {
  notification_id: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  circle_id: string | null;
  attempts: number;
  lease: string;
};

export function allowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && !url.username && !url.password &&
      ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(url.hostname);
  } catch { return false; }
}

export function pushPayload(delivery: Pick<Delivery, "circle_id" | "notification_id">) {
  return {
    path: delivery.circle_id ? `/app/${delivery.circle_id}/notifications` : "/app",
    tag: delivery.notification_id
  };
}

export async function sendPushBatch(supabase: SupabaseClient) {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) return;
  const { data, error } = await supabase.rpc("claim_notification_pushes");
  if (error) throw new Error("Unable to claim push deliveries");
  const failures = await Promise.all(((data ?? []) as Delivery[]).map(async (delivery) => {
    const { notification_id, subscription_id, lease } = delivery;
    const { data: permitted, error: accessError } = await supabase.rpc("can_send_notification_push", {
      p_notification: notification_id, p_subscription: subscription_id, p_lease: lease
    });
    if (accessError) return true;
    if (!permitted) return false;

    let finished = !allowedPushEndpoint(delivery.endpoint);
    if (!finished) {
      try {
        const request = webpush.generateRequestDetails({
          endpoint: delivery.endpoint,
          keys: { p256dh: delivery.p256dh, auth: delivery.auth_key }
        }, JSON.stringify(pushPayload(delivery)), {
          vapidDetails: { subject, publicKey, privateKey },
          TTL: 600,
          topic: notification_id.replaceAll("-", "")
        });
        const response = await fetch(request.endpoint, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          signal: AbortSignal.timeout(5000),
          redirect: "error"
        });
        if (response.body) await response.body.cancel();
        if (response.status === 404 || response.status === 410) {
          const { error: removeError } = await supabase.from("push_subscriptions").delete().eq("id", subscription_id);
          return !!removeError;
        }
        finished = response.ok || (response.status < 500 && response.status !== 429) || delivery.attempts >= 4;
      } catch {
        finished = delivery.attempts >= 4;
      }
    }
    const { error: updateError } = await supabase.from("push_deliveries").update({
      finished,
      next_attempt_at: new Date(Date.now() + 300000 * 2 ** (delivery.attempts - 1)).toISOString()
    }).eq("notification_id", notification_id).eq("subscription_id", subscription_id).eq("lease", lease);
    return !!updateError;
  }));
  if (failures.some(Boolean)) throw new Error("Unable to update push delivery state");
}
