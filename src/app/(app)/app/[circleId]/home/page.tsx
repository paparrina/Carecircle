import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTodayDoses, type TodayDose } from "@/lib/meds/queries";
import { getNextAppointment } from "@/lib/events/queries";
import { lastNDates, nextOccurrence, timeInCircleTZ } from "@/lib/dates";
import { DATE_ICON } from "@/components/circle/important-dates";
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
  const locale = await getLocale();
  const supabase = await createClient();

  const now = new Date().toISOString();
  const [yesterday, today] = lastNDates(2);
  const currentTime = timeInCircleTZ(now);
  const [{ doses }, previous, appointment, { data: lastPost }, { data: impDates }] = await Promise.all([
    getTodayDoses(circleId, today),
    getTodayDoses(circleId, yesterday),
    getNextAppointment(circleId, now),
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
  const settings = await getTranslations("accountSettings");
  const onboarding = await getTranslations("onboarding");
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
  const pending = doses.filter((dose) => !dose.log);
  const overdue = pending.filter((dose) => dose.time < currentTime);
  const nextDose = pending.find((dose) => dose.time >= currentTime);
  const previousPending = previous.doses.filter((dose) => !dose.log);
  const responsibility = (name: string | null) => name ? tm("responsible", { name }) : t("unassigned");
  const appointmentDate = appointment
    ? new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" })
        .format(new Date(`${appointment.date}T12:00:00Z`))
    : null;
  const doseDetails = (dose: TodayDose) => (
    <>
      <p className="break-words font-semibold text-ink">{dose.time} · {dose.name}</p>
      <p className="break-words text-sm text-ink-secondary">{dose.dosage} · {responsibility(dose.assignedName)}</p>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{t("title")}</h1>
      {(previousPending.length > 0 || overdue.length > 0) && (
        <Card className="border-[#805510] bg-warning-soft">
          <CardTitle className="text-[#805510]">{t("overdueTitle")}</CardTitle>
          {[
            { date: yesterday, label: t("yesterday"), items: previousPending },
            { date: today, label: t("title"), items: overdue }
          ].filter(({ items }) => items.length > 0).map(({ date, label, items }) => (
            <div key={date} className="mt-3">
              <h3 className="text-sm font-semibold text-[#805510]">{label}</h3>
              <ul className="divide-y divide-line">
                {items.map((dose) => (
                  <li key={dose.scheduleId} className="py-2">{doseDetails(dose)}</li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}

      <Card>
        <CardTitle>{t("nextDoseTitle")}</CardTitle>
        {nextDose ? (
          <div className="mt-2">{doseDetails(nextDose)}</div>
        ) : (
          <p className="mt-2 text-ink-secondary">{t("nextDoseEmpty")}</p>
        )}
        <Link
          href={`/app/${circleId}/meds`}
          className="mt-2 inline-flex min-h-touch items-center font-semibold text-primary-dark underline underline-offset-2"
        >
          {tm("seeAll")}
        </Link>
      </Card>

      <Card>
        <CardTitle>{t("nextAppointmentTitle")}</CardTitle>
        {appointment ? (
          <Link
            href={`/app/${circleId}/calendar/${appointment.id}`}
            className="mt-2 block min-h-touch rounded-md bg-primary-soft p-3"
          >
            <span className="block text-sm text-ink-secondary">{appointmentDate} · {appointment.time}</span>
            <span className="block break-words font-semibold text-primary-dark underline underline-offset-2">{appointment.title}</span>
            <span className="block break-words text-sm text-ink-secondary">{responsibility(appointment.assignedName)}</span>
          </Link>
        ) : (
          <p className="mt-2 text-ink-secondary">{t("nextAppointmentEmpty")}</p>
        )}
        <Link
          href={`/app/${circleId}/calendar`}
          className="mt-2 inline-flex min-h-touch items-center font-semibold text-primary-dark underline underline-offset-2"
        >
          {t("openCalendar")}
        </Link>
      </Card>

      <Link href={`/app/${circleId}/welcome`} className="inline-flex min-h-touch items-center font-semibold text-primary-dark underline">
        {onboarding("resumeTutorial")}
      </Link>

      <Link href={`/app/${circleId}/settings`} className="inline-flex min-h-touch items-center font-semibold text-primary-dark underline">
        {settings("title")}
      </Link>

      {upcomingDates.length > 0 && (
        <Card>
          <CardTitle>{t("importantDatesTitle")}</CardTitle>
          <ul className="mt-3 flex flex-col gap-2.5">
            {upcomingDates.map((d) => {
              const Icon = DATE_ICON[d.type as keyof typeof DATE_ICON];
              return (
                <li key={d.id}>
                  <Link
                    href={`/app/${circleId}/profile`}
                    className="flex min-h-touch flex-wrap items-center gap-3 rounded-md bg-warning-soft px-3.5 py-3"
                  >
                    <Icon size={21} aria-hidden className="shrink-0 text-[#805510]" />
                    <span className="min-w-0 flex-1 break-words font-medium text-ink">{d.title}</span>
                    <span className="text-sm font-semibold text-[#805510]">{daysLabel(d.next.daysUntil)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

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
