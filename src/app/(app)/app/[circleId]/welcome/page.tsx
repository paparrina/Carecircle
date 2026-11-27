import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export default async function WelcomePage({ params }: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const base = `/app/${circleId}`;
  const t = await getTranslations("onboarding");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [recipient, meds, events, members, invitations] = await Promise.all([
    supabase.from("care_recipients").select("full_name").eq("circle_id", circleId).limit(1).maybeSingle(),
    supabase.from("medications").select("id", { count: "exact", head: true }).eq("circle_id", circleId),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("circle_id", circleId),
    supabase.from("circle_members").select("user_id,role").eq("circle_id", circleId),
    supabase.from("invitations").select("id", { count: "exact", head: true }).eq("circle_id", circleId)
      .or(`accepted_at.not.is.null,expires_at.gt.${new Date().toISOString()}`)
  ]);
  const role = members.data?.find((m) => m.user_id === user?.id)?.role;
  const canEdit = role === "coordinator" || role === "member";
  const steps = [
    { label: t("circleCreated"), done: true, href: null },
    { label: t("recipientAdded"), done: !!recipient.data, href: canEdit ? `${base}/profile` : null },
    { label: t("step1"), done: (meds.count ?? 0) > 0, href: canEdit ? `${base}/meds/new` : null },
    { label: t("step2"), done: (events.count ?? 0) > 0, href: canEdit ? `${base}/calendar/new` : null },
    { label: t("step3"), done: (invitations.count ?? 0) > 0 || (members.data?.length ?? 0) > 1,
      href: role === "coordinator" ? `${base}/members` : null }
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("checklistTitle")}</h1>
      <p className="text-ink-secondary">{t("tutorialIntro")}</p>
      <Card>
        <ol className="list-decimal space-y-2 pl-6">
          {steps.map(({ label, done, href }) => (
            <li key={label} className="pl-1">
              {done ? (
                <span className="flex min-h-touch items-center gap-2">
                  <Check aria-hidden size={18} className="shrink-0 text-success" />
                  {label}<span className="sr-only"> · {t("stepDone")}</span>
                </span>
              ) : href ? (
                <Link className="flex min-h-touch items-center font-semibold text-primary-dark underline" href={href}>{label}</Link>
              ) : <span className="flex min-h-touch items-center">{label} · {t("askCoordinator")}</span>}
            </li>
          ))}
        </ol>
      </Card>
      <Link className="inline-flex min-h-touch items-center font-semibold text-primary-dark underline" href={`${base}/home`}>
        {t("goToToday")}
      </Link>
    </div>
  );
}
