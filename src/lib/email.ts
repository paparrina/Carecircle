// Envío de email transaccional con Resend (https://resend.com).
// Si RESEND_API_KEY no está configurada, no se envía (el enlace se comparte a mano).

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Zircol <onboarding@resend.dev>";
  if (!key) return { sent: false };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html })
  });
  return { sent: res.ok };
}

/**
 * `inviterName`/`recipientName` son texto libre elegido por cualquier miembro del
 * círculo (perfil o ficha de la persona cuidada). Sin escapar, alguien podría poner
 * HTML/JS como su nombre y que se ejecutara en el cliente de correo de cualquiera
 * que reciba una invitación.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function inviteEmailHtml(p: {
  inviterName: string;
  recipientName: string;
  url: string;
}): string {
  const inviterName = escapeHtml(p.inviterName);
  const recipientName = escapeHtml(p.recipientName);
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#F7FAFB;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #E4E0DA">
    <h1 style="color:#1F2933;font-size:22px;margin:0 0 12px">Te han invitado a Zircol</h1>
    <p style="color:#52606D;font-size:16px;line-height:1.6;margin:0 0 20px">
      <b>${inviterName}</b> te invita a unirte al círculo de cuidado de
      <b>${recipientName}</b>: medicación, citas médicas, documentos y avisos
      de toda la familia, en un solo lugar.
    </p>
    <a href="${p.url}" style="display:inline-block;background:#4A7FA7;color:#fff;
      text-decoration:none;font-size:17px;font-weight:600;padding:14px 24px;border-radius:12px">
      Unirme al círculo
    </a>
    <p style="color:#8A94A0;font-size:13px;margin:24px 0 0">
      El enlace caduca en 7 días. Si no esperabas esta invitación, puedes ignorar este correo.
    </p>
  </div></body></html>`;
}
