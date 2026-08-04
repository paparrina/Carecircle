import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarDays, ChevronRight, FolderOpen, Pill } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export default async function WelcomePage({
  params
}: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const t = await getTranslations("onboarding");
  const supabase = await createClient();
  const { data: recipient } = await supabase
    .from("care_recipients")
    .select("full_name")
    .eq("circle_id", circleId)
    .limit(1)
    .maybeSingle();
  const firstName = recipient?.full_name?.split(" ")[0] ?? "";

  const cards = [
    {
      href: `/app/${circleId}/meds/new`,
      icon: Pill,
      title: t("cardMeds"),
      text: t("cardMedsText")
    },
    {
      href: `/app/${circleId}/calendar/new`,
      icon: CalendarDays,
      title: t("cardEvents"),
      text: t("cardEventsText")
    },
    {
      href: `/app/${circleId}/docs`,
      icon: FolderOpen,
      title: t("cardDocs"),
      text: t("cardDocsText")
    }
  ];

  return (
    <div className="flex flex-col gap-2 py-4">
      <h1 className="text-2xl font-semibold leading-tight text-ink">
        {t("welcomeTitle", { name: firstName })}
      </h1>
      <p className="text-lg font-medium text-ink">{t("welcomeQuestion")}</p>
      <p className="text-[15.5px] text-ink-secondary">{t("welcomeHint")}</p>

      <div className="mt-4 flex flex-col gap-3">
        {cards.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href}>
            <Card className="flex items-center gap-3.5 hover:border-primary">
              <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-lg bg-primary-soft p-3 text-primary">
                <Icon size={26} strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold text-ink">
                  {title}
                </span>
                <span className="block text-[15px] leading-snug text-ink-secondary">
                  {text}
                </span>
              </span>
              <ChevronRight className="shrink-0 text-ink-secondary" />
            </Card>
          </Link>
        ))}
      </div>

      <Link
        href={`/app/${circleId}/home`}
        className="mt-4 inline-flex min-h-touch items-center justify-center rounded-md text-[16px] font-medium text-ink-secondary underline underline-offset-2"
      >
        {t("later")}
      </Link>
    </div>
  );
}
