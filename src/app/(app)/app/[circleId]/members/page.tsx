import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { InviteComposer } from "@/components/members/invite-composer";
import { MemberRow } from "@/components/members/member-row";
import { InvitationRow } from "@/components/members/invitation-row";

export default async function MembersPage({
  params
}: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const t = await getTranslations("members");
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [{ data: rows }, { data: recipient }] = await Promise.all([
    supabase
      .from("circle_members")
      .select("id, user_id, role, profiles:user_id(full_name)")
      .eq("circle_id", circleId)
      .order("joined_at"),
    supabase
      .from("care_recipients")
      .select("full_name")
      .eq("circle_id", circleId)
      .limit(1)
      .maybeSingle()
  ]);

  const members = (rows ?? []).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      rowId: m.id as string,
      userId: m.user_id as string,
      name: p?.full_name ?? "",
      role: m.role as string
    };
  });
  const myRole = members.find((m) => m.userId === user?.id)?.role;
  const canManage = myRole === "coordinator";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const invitations = canManage
    ? (
        await supabase
          .from("invitations")
          .select("id, email, role, token, expires_at")
          .eq("circle_id", circleId)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      ).data ?? []
    : [];

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      timeZone: "Europe/Madrid"
    }).format(new Date(iso));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-ink">{t("title")}</h1>

      <Card>
        <ul>
          {members.map((m) => (
            <MemberRow
              key={m.rowId}
              circleId={circleId}
              rowId={m.rowId}
              name={m.name}
              role={m.role}
              isSelf={m.userId === user?.id}
              canManage={canManage}
            />
          ))}
        </ul>
      </Card>

      {canManage && (
        <>
          <InviteComposer
            circleId={circleId}
            recipientFirstName={recipient?.full_name?.split(" ")[0] ?? ""}
          />

          {invitations.length > 0 && (
            <Card>
              <CardTitle>{t("pendingTitle")}</CardTitle>
              <ul className="mt-1">
                {invitations.map((inv) => (
                  <InvitationRow
                    key={inv.id}
                    circleId={circleId}
                    id={inv.id}
                    email={inv.email}
                    role={inv.role}
                    url={`${siteUrl}/invite/${inv.token}`}
                    expiresLabel={t("expires", {
                      date: fmtDate(inv.expires_at)
                    })}
                  />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
