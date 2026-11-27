import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createECDH, randomBytes } from "node:crypto";
import webpush from "npm:web-push@3.6.7";
import { allowedPushEndpoint, pushPayload, sendPushBatch } from "./push.ts";

Deno.test("push endpoint validation and generic payload", () => {
  if (!allowedPushEndpoint("https://web.push.apple.com/token")) throw new Error("Apple endpoint rejected");
  if (!allowedPushEndpoint("https://fcm.googleapis.com/fcm/send/token")) throw new Error("FCM endpoint rejected");
  if (allowedPushEndpoint("https://fcm.googleapis.com.example.test/token") ||
      allowedPushEndpoint("https://web.push.apple.com:123/token") ||
      allowedPushEndpoint("http://updates.push.services.mozilla.com/token")) throw new Error("Unsafe endpoint accepted");
  const payload = pushPayload({ circle_id: "circle", notification_id: "notification" });
  if (JSON.stringify(payload) !== '{"path":"/app/circle/notifications","tag":"notification"}') {
    throw new Error("Unexpected fields in push payload");
  }
});

Deno.test("worker retries throttled deliveries and removes expired subscriptions", async () => {
  const vapid = webpush.generateVAPIDKeys();
  const keys = { VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey,
    VAPID_SUBJECT: "mailto:push-test@example.test" };
  const original = Object.fromEntries(Object.keys(keys).map((key) => [key, Deno.env.get(key)]));
  const originalFetch = globalThis.fetch;
  const receiver = createECDH("prime256v1");
  receiver.generateKeys();
  const delivery = {
    notification_id: "00000000-0000-0000-0000-000000000001", subscription_id: "a", lease: "b",
    endpoint: "https://fcm.googleapis.com/fcm/send/example",
    p256dh: receiver.getPublicKey().toString("base64url"),
    auth_key: randomBytes(16).toString("base64url"), attempts: 1, circle_id: null
  };
  let status = 429;
  let deleted = false;
  const updates: { finished: boolean }[] = [];
  const response = { error: null, eq: () => response };
  const mock = {
    rpc: (method: string) => ({ data: method === "claim_notification_pushes" ? [delivery] : true }),
    from: () => ({
      update: (update: { finished: boolean }) => { updates.push(update); return response; },
      delete: () => { deleted = true; return response; }
    })
  } as unknown as SupabaseClient;
  try {
    for (const [key, value] of Object.entries(keys)) Deno.env.set(key, value);
    globalThis.fetch = (_url, init) => {
      if (init?.redirect !== "error" || !init.body || init.method !== "POST") throw new Error("Invalid push request");
      return Promise.resolve(new Response(null, { status }));
    };
    await sendPushBatch(mock);
    if (updates.length !== 1 || updates[0].finished) throw new Error("Throttled delivery was not rescheduled");
    status = 410;
    await sendPushBatch(mock);
    if (!deleted) throw new Error("Expired subscription was not deleted");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});
