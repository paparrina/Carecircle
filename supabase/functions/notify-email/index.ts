// Edge Function: envía por email (Resend) las notificaciones críticas recientes.
// Prográmala cada 5 min (Supabase → Edge Functions → Schedules, o pg_cron + pg_net).
// Secrets necesarios: RESEND_API_KEY, EMAIL_FROM (opcional), CRON_SECRET.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY se inyectan automáticamente.
//
// CRON_SECRET: la función no comprobaba quién la llamaba, así que cualquiera con la
// clave anon (pública en el bundle del cliente) podía invocarla repetidamente y forzar
// envíos de correo (coste y spam). El programador (cron/pg_net) debe enviar la cabecera
// `x-cron-secret` con el mismo valor que este secreto.

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPushBatch } from "./push.ts";

type PendingEmail = { id: string; user_id: string; email_attempts: number };

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return new Response("CRON_SECRET missing", { status: 503 });
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let cleanupFailed = false;
  const { data: abandoned, error: claimError } = await supabase.rpc(
    "claim_abandoned_document_uploads"
  );
  if (claimError) {
    cleanupFailed = true;
    console.error("Document cleanup: unable to claim uploads", claimError.code);
  } else if (abandoned?.length) {
    const { error: removeError } = await supabase.storage.from("documents").remove(abandoned);
    if (removeError) {
      cleanupFailed = true;
      console.error("Document cleanup: Storage removal failed", removeError.statusCode);
    }
  }

  let pushFailed = false;
  try {
    await sendPushBatch(supabase);
  } catch {
    pushFailed = true;
    console.error("Push notifications: batch failed");
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return new Response("RESEND_API_KEY missing", { status: 503 });
  const from = Deno.env.get("EMAIL_FROM") ?? "CareCircle <onboarding@resend.dev>";

  const { data: notifs, error: queryError } = await supabase.rpc("pending_notification_emails");

  if (queryError) return new Response("Notification lookup failed", { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const n of (notifs ?? []) as PendingEmail[]) {
    try {
      const { data: u, error: userError } = await supabase.auth.admin.getUserById(n.user_id);
      const email = u?.user?.email;
      if (userError || !email) throw new Error("Missing recipient");
      const subject = "Tienes un aviso en CareCircle";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `carecircle-notification-${n.id}`
        },
        body: JSON.stringify({
          from,
          to: email,
          subject,
          html: `<div style="font-family:system-ui;padding:24px">
            <h2 style="color:#1F2933">${subject}</h2>
            <p style="color:#52606D">Abre CareCircle para ver los detalles.</p></div>`
        })
      });
      if (!res.ok) {
        throw new Error(`Resend HTTP ${res.status}`);
      }
      const { error: markError } = await supabase
        .from("notifications")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", n.id);
      if (markError) throw new Error("Could not mark notification as sent");
      sent++;
    } catch (err) {
      failed++;
      const delayMinutes = 5 * 2 ** n.email_attempts;
      const { error: retryError } = await supabase.from("notifications")
        .update({
          email_attempts: n.email_attempts + 1,
          email_next_attempt_at: new Date(Date.now() + delayMinutes * 60000).toISOString()
        })
        .eq("id", n.id)
        .eq("email_attempts", n.email_attempts)
        .is("email_sent_at", null);
      if (retryError) console.error("notify-email: could not schedule retry", n.id);
      console.error("notify-email: send failed", n.id, err);
    }
  }

  return new Response(
    JSON.stringify({ processed: notifs?.length ?? 0, sent, failed, cleanupFailed, pushFailed }),
    { headers: { "Content-Type": "application/json" } }
  );
});
