import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, Plus } from "lucide-react";
import { getEventsBetween, getUpcomingEvents } from "@/lib/events/queries";
import { madridToUTC, todayInCircleTZ } from "@/lib/dates";
import { EventCard } from "@/components/calendar/event-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

function addDays(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function monthRange(m: string): { first: string; nextFirst: string } {
  const [y, mo] = m.split("-").map(Number);
  const first = `${m}-01`;
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  return { first, nextFirst: `${next}-01` };
}

export default async function CalendarPage({
  params,
  searchParams
}: {
  params: Promise<{ circleId: string }>;
  searchParams: Promise<{ view?: string; m?: string; d?: string }>;
}) {
  const { circleId } = await params;
  const sp = await searchParams;
  const t = await getTranslations("calendar");
  const locale = await getLocale();
  const today = todayInCircleTZ();
  const isMonth = sp.view === "month";

  const tabs = (
    <div className="mb-4 flex rounded-md border border-line bg-surface p-1">
      {[
        { href: `/app/${circleId}/calendar`, label: t("viewAgenda"), on: !isMonth },
        {
          href: `/app/${circleId}/calendar?view=month`,
          label: t("viewMonth"),
          on: isMonth
        }
      ].map(({ href, label, on }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex min-h-touch flex-1 items-center justify-center rounded-[9px] text-[16px] font-semibold",
            on ? "bg-primary text-white" : "text-ink-secondary"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );

  const fab = (
    <Link
      href={`/app/${circleId}/calendar/new`}
      className="fixed bottom-24 right-4 z-30 flex min-h-cta items-center gap-2 rounded-full bg-primary px-5 text-[17px] font-semibold text-white shadow-lg hover:bg-primary-dark"
    >
      <Plus size={22} /> {t("add")}
    </Link>
  );

  const fmtDay = (dateISO: string) => {
    if (dateISO === today) return t("today");
    if (dateISO === addDays(today, 1)) return t("tomorrow");
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Madrid"
    }).format(new Date(`${dateISO}T12:00:00`));
  };

  if (!isMonth) {
    const events = await getUpcomingEvents(
      circleId,
      madridToUTC(today, "00:00")
    );
    const byDay = new Map<string, typeof events>();
    for (const e of events) {
      if (!byDay.has(e.date)) byDay.set(e.date, []);
      byDay.get(e.date)!.push(e);
    }

    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold text-ink">{t("title")}</h1>
        {tabs}
        {events.length === 0 ? (
          <Card>
            <EmptyState
              icon={CalendarDays}
              text={t("empty")}
              ctaLabel={t("emptyCta")}
              ctaHref={`/app/${circleId}/calendar/new`}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-5">
            {[...byDay.entries()].map(([date, list]) => (
              <section key={date}>
                <h2 className="mb-2 text-[15px] font-semibold uppercase tracking-wide text-ink-secondary first-letter:uppercase">
                  {fmtDay(date)}
                </h2>
                <div className="flex flex-col gap-2.5">
                  {list.map((e) => (
                    <EventCard
                      key={e.id}
                      circleId={circleId}
                      event={e}
                      assignedLabel={(n) => t("assigned", { name: n })}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {fab}
      </div>
    );
  }

  // ---- Vista mes ----
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7);
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "")
    ? sp.d!
    : today.startsWith(month)
      ? today
      : `${month}-01`;

  const { first, nextFirst } = monthRange(month);
  const events = await getEventsBetween(
    circleId,
    madridToUTC(first, "00:00"),
    madridToUTC(nextFirst, "00:00")
  );
  const daysWithEvents = new Set(events.map((e) => e.date));
  const dayEvents = events.filter((e) => e.date === selected);

  // rejilla del mes (lunes primero)
  const firstD = new Date(`${first}T12:00:00Z`);
  const startOffset = (firstD.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    firstD.getUTCFullYear(),
    firstD.getUTCMonth() + 1,
    0
  ).getDate();
  const cells: (string | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      `${month}-${String(i + 1).padStart(2, "0")}`
    )
  ];
  const prevMonth = addDays(first, -1).slice(0, 7);
  const nextMonth = nextFirst.slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid"
  }).format(new Date(`${first}T12:00:00`));
  const weekdayHeads = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "narrow",
      timeZone: "Europe/Madrid"
    }).format(new Date(Date.UTC(2024, 0, i + 1)))
  );

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-ink">{t("title")}</h1>
      {tabs}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <Link
            href={`/app/${circleId}/calendar?view=month&m=${prevMonth}`}
            className="flex h-11 w-11 items-center justify-center rounded-md text-xl text-ink-secondary hover:bg-primary-soft"
            aria-label="◀"
          >
            ◀
          </Link>
          <p className="text-lg font-semibold capitalize text-ink">
            {monthLabel}
          </p>
          <Link
            href={`/app/${circleId}/calendar?view=month&m=${nextMonth}`}
            className="flex h-11 w-11 items-center justify-center rounded-md text-xl text-ink-secondary hover:bg-primary-soft"
            aria-label="▶"
          >
            ▶
          </Link>
        </div>
        <div className="grid grid-cols-7 text-center text-[13px] font-semibold text-ink-secondary">
          {weekdayHeads.map((w, i) => (
            <span key={i} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((date, i) =>
            date === null ? (
              <span key={`x${i}`} />
            ) : (
              <Link
                key={date}
                href={`/app/${circleId}/calendar?view=month&m=${month}&d=${date}`}
                className={cn(
                  "mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-full text-[16px]",
                  date === selected
                    ? "bg-primary font-bold text-white"
                    : date === today
                      ? "bg-primary-soft font-bold text-primary-dark"
                      : "text-ink hover:bg-background"
                )}
              >
                {Number(date.slice(8))}
                <span
                  className={cn(
                    "mt-0.5 h-1.5 w-1.5 rounded-full",
                    daysWithEvents.has(date)
                      ? date === selected
                        ? "bg-white"
                        : "bg-primary"
                      : "bg-transparent"
                  )}
                />
              </Link>
            )
          )}
        </div>
      </Card>

      <section className="mt-4">
        <h2 className="mb-2 text-[15px] font-semibold uppercase tracking-wide text-ink-secondary first-letter:uppercase">
          {fmtDay(selected)}
        </h2>
        {dayEvents.length === 0 ? (
          <p className="text-[16px] text-ink-secondary">{t("emptyDay")}</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {dayEvents.map((e) => (
              <EventCard
                key={e.id}
                circleId={circleId}
                event={e}
                assignedLabel={(n) => t("assigned", { name: n })}
              />
            ))}
          </div>
        )}
      </section>
      {fab}
    </div>
  );
}
