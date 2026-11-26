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

const EMAIL_TYPES = ["event_reminder", "med_missed", "mention", "important_date"];

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return new Response("CRON_SECRET missing", { status: 503 });
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("unauthorized", { status: 401 });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return new Response("RESEND_API_KEY missing", { status: 503 });
  const from = Deno.env.get("EMAIL_FROM") ?? "CareCircle <onboarding@resend.dev>";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: notifs, error: queryError } = await supabase
    .from("notifications")
    .select("id, user_id")
    .in("type", EMAIL_TYPES)
    .is("email_sent_at", null)
    .gte("created_at", since)
    .limit(50);

  if (queryError) return new Response("Notification lookup failed", { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const n of notifs ?? []) {
    try {
      const { data: u } = await supabase.auth.admin.getUserById(n.user_id);
      const email = u?.user?.email;
      if (!email) continue;
      const subject = "Tienes un aviso en CareCircle";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
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
      // Antes se marcaba email_sent_at pasara lo que pasara, incluido un 4xx/5xx de
      // Resend: la notificación quedaba como "enviada" sin haberse entregado nunca, y
      // no se reintentaba. Ahora solo se marca cuando Resend confirma éxito; si falla,
      // la siguiente ejecución (dentro de la ventana de 1h) volverá a intentarlo.
      if (res.ok) {
        const { error: markError } = await supabase
          .from("notifications")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", n.id);
        if (markError) throw new Error("Could not mark notification as sent");
        sent++;
      } else {
        failed++;
        console.error(
          `notify-email: Resend rechazó el envío de la notificación ${n.id} (HTTP ${res.status})`
        );
      }
    } catch (err) {
      failed++;
      console.error(`notify-email: fallo procesando la notificación ${n.id}:`, err);
    }
  }
  return new Response(
    JSON.stringify({ processed: notifs?.length ?? 0, sent, failed }),
    { headers: { "Content-Type": "application/json" } }
  );
});
