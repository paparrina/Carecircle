// Edge Function: envía por email (Resend) las notificaciones críticas recientes.
// Prográmala cada 5 min (Supabase → Edge Functions → Schedules, o pg_cron + pg_net).
// Secrets necesarios: RESEND_API_KEY, EMAIL_FROM (opcional).
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY se inyectan automáticamente.

import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_TYPES = ["event_reminder", "med_missed", "mention", "important_date"];

const SUBJECTS: Record<string, (p: Record<string, string>) => string> = {
  event_reminder: (p) => `Recordatorio: ${p.title} a las ${p.time}`,
  med_missed: (p) => `Toma sin registrar: ${p.med} (${p.time})`,
  mention: (p) => `${p.author} te ha mencionado en el muro`,
  important_date: (p) => `Fecha importante: ${p.title}`
};

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") ?? "CareCircle <onboarding@resend.dev>";
  if (!resendKey) return new Response("RESEND_API_KEY missing", { status: 200 });

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: notifs } = await supabase
    .from("notifications")
    .select("id, user_id, type, payload")
    .in("type", EMAIL_TYPES)
    .is("email_sent_at", null)
    .gte("created_at", since)
    .limit(50);

  let sent = 0;
  for (const n of notifs ?? []) {
    const { data: u } = await supabase.auth.admin.getUserById(n.user_id);
    const email = u?.user?.email;
    if (!email) continue;
    const p = (n.payload ?? {}) as Record<string, string>;
    const subject = SUBJECTS[n.type]?.(p) ?? "Novedades en CareCircle";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json"
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
    await supabase
      .from("notifications")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", n.id);
    if (res.ok) sent++;
  }
  return new Response(JSON.stringify({ processed: notifs?.length ?? 0, sent }), {
    headers: { "Content-Type": "application/json" }
  });
});
