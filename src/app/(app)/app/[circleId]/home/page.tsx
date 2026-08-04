import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarDays, MessagesSquare, Pill } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTodayDoses } from "@/lib/meds/queries";
import { getEventsBetween } from "@/lib/events/queries";
import { madridToUTC, nextOccurrence, todayInCircleTZ } from "@/lib/dates";
import { DATE_ICON } from "@/components/circle/important-dates";
import { OnboardingChecklist } from "@/components/circle/onboarding-checklist";
import { EventCard } from "@/components/calendar/event-card";
import { TodayDoseList } from "@/components/meds/today-list";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

export default async function HomePage({
  params
}: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const t = await getTranslations("home");
  const tm = await getTranslations("meds");
  const tCal = await getTranslations("calendar");
  const supabase = await createClient();

  const today = todayInCircleTZ();
  const tomorrow = new Date(new Date(`${today}T12:00:00Z`).getTime() + 86400000)
    .toISOString()
    .slice(0, 10);

  const [{ data: recipient }, { date, doses }, todayEvents, { data: lastPost }, { data: impDates }] = await Promise.all([
    supabase
      .from("care_recipients")
      .select("full_name")
      .eq("circle_id", circleId)
      .limit(1)
      .maybeSingle(),
    getTodayDoses(circleId),
    getEventsBetween(circleId, madridToUTC(today, "00:00"), madridToUTC(tomorrow, "00:00")),
    supabase
      .from("posts")
      .select("body, author:author_id(full_name)")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("important_dates")
      .select("id, title, date, type, recurring")
      .eq("circle_id", circleId)
  ]);
  const [
    { count: memberCount },
    { count: docCount },
    { count: medCount },
    { count: eventCount }
  ] = await Promise.all([
    supabase
      .from("circle_members")
      .select("id", { count: "exact", head: true })
      .eq("circle_id", circleId),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("circle_id", circleId),
    supabase
      .from("medications")
      .select("id", { count: "exact", head: true })
      .eq("circle_id", circleId),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("circle_id", circleId)
  ]);
  const tDates = await getTranslations("importantDates");
  const upcomingDates = (impDates ?? [])
    .map((d) => ({ ...d, next: nextOccurrence(d.date, d.recurring, today) }))
    .filter((d) => d.next.daysUntil >= 0 && d.next.daysUntil <= 7)
    .sort((a, b) => a.next.daysUntil - b.next.daysUntil)
    .slice(0, 3);
  const daysLabel = (n: number) =>
    n === 0 ? tDates("today") : n === 1 ? tDates("tomorrow") : tDates("inDays", { d: n });
  const lastAuthor = lastPost
    ? (Array.isArray(lastPost.author) ? lastPost.author[0] : lastPost.author)
        ?.full_name?.split(" ")[0]
    : null;
  const firstName = recipient?.full_name?.split(" ")[0] ?? "";
  const done = doses.filter((d) => d.log).length;

  return (
    <div className="flex flex-col gap-4">
      <OnboardingChecklist
        circleId={circleId}
        hasMed={(medCount ?? 0) > 0}
        hasEvent={(eventCount ?? 0) > 0}
        hasSecondMember={(memberCount ?? 0) > 1}
        hasDoc={(docCount ?? 0) > 0}
      />
      <Card>
        <div className="flex items-baseline justify-between">
          <CardTitle>{t("medsTitle")}</CardTitle>
          {doses.length > 0 && (
            <span className="text-[15px] font-semibold text-primary">
              {tm("progress", { done, total: doses.length })}
            </span>
          )}
        </div>
        {doses.length === 0 ? (
          <EmptyState
            icon={Pill}
            text={t("medsEmpty")}
            ctaLabel={t("medsEmptyCta", { name: firstName })}
            ctaHref={`/app/${circleId}/meds/new`}
          />
        ) : (
          <>
            <TodayDoseList
              circleId={circleId}
              date={date}
              doses={doses}
              compact
            />
            <Link
              href={`/app/${circleId}/meds`}
              className="mt-2 block text-[15px] font-semibold text-primary underline underline-offset-2"
            >
              {tm("seeAll")}
            </Link>
          </>
        )}
      </Card>

      <Card>
        <CardTitle>{t("agendaTitle")}</CardTitle>
        {todayEvents.length === 0 && upcomingDates.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            text={t("agendaEmpty")}
            ctaLabel={t("agendaEmptyCta")}
            ctaHref={`/app/${circleId}/calendar/new`}
          />
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {todayEvents.map((e) => (
              <EventCard
                key={e.id}
                circleId={circleId}
                event={e}
                assignedLabel={(n) => tCal("assigned", { name: n })}
              />
            ))}
            {upcomingDates.map((d) => {
              const Icon = DATE_ICON[d.type as keyof typeof DATE_ICON];
              return (
                <Link
                  key={d.id}
                  href={`/app/${circleId}/profile`}
                  className="flex items-center gap-3 rounded-md bg-warning-soft px-3.5 py-3"
                >
                  <Icon size={21} className="shrink-0 text-warning" />
                  <span className="min-w-0 flex-1 truncate text-[15.5px] font-medium text-ink">
                    {d.title}
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold text-warning">
                    {daysLabel(d.next.daysUntil)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>{t("wallTitle")}</CardTitle>
        {lastPost ? (
          <Link href={`/app/${circleId}/wall`} className="mt-2 block">
            <p className="line-clamp-2 text-[16px] leading-relaxed text-ink">
              <span className="font-semibold">{lastAuthor}:</span>{" "}
              {lastPost.body}
            </p>
          </Link>
        ) : (
          <EmptyState
            icon={MessagesSquare}
            text={t("wallEmpty")}
            ctaLabel={t("wallEmptyCta")}
            ctaHref={`/app/${circleId}/wall`}
          />
        )}
      </Card>
    </div>
  );
}
