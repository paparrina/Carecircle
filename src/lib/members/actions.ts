"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { inviteSchema, roleChangeSchema } from "@/lib/validators";
import { inviteEmailHtml, sendEmail } from "@/lib/email";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Crea una invitación (genérica o por email). Devuelve la URL para compartir. */
export async function createInvitation(input: {
  circleId: string;
  role: "member" | "viewer";
  email?: string;
}): Promise<{ url?: string; emailSent?: boolean; error?: string }> {
  const parsed = inviteSchema.safeParse({
    circleId: input.circleId,
    role: input.role,
    email: input.email ?? ""
  });
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "auth" };

  const { data: inv, error } = await supabase
    .from("invitations")
    .insert({
      circle_id: parsed.data.circleId,
      role: parsed.data.role,
      email: parsed.data.email || null,
      invited_by: user.id
    })
    .select("token")
    .single();
  if (error || !inv) return { error: "generic" };

  const url = `${siteUrl()}/invite/${inv.token}`;
  let emailSent = false;

  if (parsed.data.email) {
    const [{ data: recipient }, { data: profile }] = await Promise.all([
      supabase
        .from("care_recipients")
        .select("full_name")
        .eq("circle_id", parsed.data.circleId)
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    ]);
    const { sent } = await sendEmail({
      to: parsed.data.email,
      subject: `${profile?.full_name ?? "Un familiar"} te invita a Zircol`,
      html: inviteEmailHtml({
        inviterName: profile?.full_name ?? "Un familiar",
        recipientName: recipient?.full_name ?? "",
        url
      })
    });
    emailSent = sent;
  }

  revalidatePath(`/app/${parsed.data.circleId}/members`);
  return { url, emailSent };
}

export async function revokeInvitation(circleId: string, invitationId: string) {
  const supabase = await createClient();
  await supabase.from("invitations").delete().eq("id", invitationId);
  revalidatePath(`/app/${circleId}/members`);
}

async function coordinatorCount(circleId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("circle_members")
    .select("id", { count: "exact", head: true })
    .eq("circle_id", circleId)
    .eq("role", "coordinator");
  return count ?? 0;
}

export async function updateMemberRole(input: {
  circleId: string;
  memberRowId: string;
  role: "coordinator" | "member" | "viewer";
}): Promise<{ error?: string }> {
  const parsed = roleChangeSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createClient();

  // Comprobación temprana para un buen mensaje; la garantía real (atómica,
  // inmune a condiciones de carrera o a llamar la API directamente) la impone
  // el trigger circle_members_prevent_zero_coordinators en la base de datos.
  const { data: target } = await supabase
    .from("circle_members")
    .select("role")
    .eq("id", parsed.data.memberRowId)
    .maybeSingle();
  if (
    target?.role === "coordinator" &&
    parsed.data.role !== "coordinator" &&
    (await coordinatorCount(parsed.data.circleId)) <= 1
  ) {
    return { error: "last_coordinator" };
  }

  const { error } = await supabase
    .from("circle_members")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.memberRowId);
  if (error) {
    if (error.message?.includes("circle_requires_at_least_one_coordinator")) {
      return { error: "last_coordinator" };
    }
    return { error: "generic" };
  }

  revalidatePath(`/app/${parsed.data.circleId}`, "layout");
  return {};
}

export async function removeMember(
  circleId: string,
  memberRowId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("circle_members")
    .select("role, user_id")
    .eq("id", memberRowId)
    .maybeSingle();
  if (
    target?.role === "coordinator" &&
    (await coordinatorCount(circleId)) <= 1
  ) {
    return { error: "last_coordinator" };
  }
  const { error } = await supabase
    .from("circle_members")
    .delete()
    .eq("id", memberRowId);
  if (error) {
    if (error.message?.includes("circle_requires_at_least_one_coordinator")) {
      return { error: "last_coordinator" };
    }
    return { error: "generic" };
  }

  // Reasignar lo que tenía a su cargo: sin esto, la agenda/medicación seguía
  // mostrando como responsable a alguien que ya no está en el círculo.
  if (target?.user_id) {
    await Promise.all([
      supabase
        .from("medications")
        .update({ assigned_to: null })
        .eq("circle_id", circleId)
        .eq("assigned_to", target.user_id),
      supabase
        .from("events")
        .update({ assigned_to: null })
        .eq("circle_id", circleId)
        .eq("assigned_to", target.user_id)
        .is("completed_at", null)
    ]);
  }

  revalidatePath(`/app/${circleId}`, "layout");
  return {};
}

export async function acceptInvitation(token: string) {
  const supabase = await createClient();
  const { data: circleId, error } = await supabase.rpc("accept_invitation", {
    p_token: token
  });
  if (error || !circleId) {
    const code = error?.message?.includes("invitation_email_mismatch")
      ? "email_mismatch"
      : error?.message?.includes("invitation_already_used")
        ? "already_used"
        : "invalid";
    redirect(`/invite/${token}?error=${code}`);
  }
  revalidatePath("/app", "layout");
  redirect(`/app/${circleId}/home`);
}
