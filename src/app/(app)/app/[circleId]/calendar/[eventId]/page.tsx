import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { MapPin, Pencil, Phone, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/circle/queries";
import { dateInCircleTZ, timeInCircleTZ } from "@/lib/dates";
import { Card, CardTitle } from "@/components/ui/card";
import { EVENT_ICON, EVENT_TINT } from "@/components/calendar/event-bits";
import { EventAdminButtons } from "@/components/calendar/event-admin-buttons";
import type { Doctor } from "@/components/circle/types";
import { cn } from "@/lib/utils";

export default async function EventDetailPage({
  params
}: {
  params: Promise<{ circleId: string; eventId: string }>;
}) {
  const { circleId, eventId } = await params;
  const t = await getTranslations("calendar");
  const tShell = await getTranslations("shell");
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: event }, role, { data: recipient }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, type, starts_at, ends_at, location, notes, completed_at, assigned:assigned_to(full_name)"
      )
      .eq("id", eventId)
      .eq("circle_id", circleId)
      .maybeSingle(),
    getMyRole(circleId),
    supabase
      .from("care_recipients")
      .select("doctors")
      .eq("circle_id", circleId)
      .limit(1)
      .maybeSingle()
  ]);
  if (!event) notFound();
  const canEdit = role === "coordinator" || role === "member";

  const Icon = EVENT_ICON[event.type];
  const assigned = Array.isArray(event.assigned)
    ? event.assigned[0]
    : event.assigned;
  const date = dateInCircleTZ(event.starts_at);
  const dayLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid"
  }).format(new Date(`${date}T12:00:00`));

  const doctors = ((recipient?.doctors ?? []) as Doctor[]).filter(
    (d) => d.phone
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg",
            EVENT_TINT[event.type]
          )}
        >
          <Icon size={28} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold uppercase tracking-wide text-ink-secondary">
            {t(`types.${event.type}` as "types.medical")}
          </p>
          <h1 className="text-2xl font-semibold leading-tight text-ink">
            {event.title}
          </h1>
          <p className="mt-1 text-lg capitalize text-ink-secondary">
            {dayLabel} · <b className="text-ink">{timeInCircleTZ(event.starts_at)}</b>
            {event.ends_at && <> – {timeInCircleTZ(event.ends_at)}</>}
          </p>
        </div>
        {canEdit && (
          <Link
            href={`/app/${circleId}/calendar/${eventId}/edit`}
            aria-label={t("edit")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-dark"
          >
            <Pencil size={20} />
          </Link>
        )}
      </div>

      {(event.location || assigned?.full_name || event.notes) && (
        <Card className="flex flex-col gap-2">
          {event.location && (
            <p className="flex items-center gap-2 text-[17px] text-ink">
              <MapPin size={20} className="shrink-0 text-primary" />
              {event.location}
            </p>
          )}
          {assigned?.full_name && (
            <p className="flex items-center gap-2 text-[17px] text-ink">
              <User size={20} className="shrink-0 text-primary" />
              {t("assigned", { name: assigned.full_name.split(" ")[0] })}
            </p>
          )}
          {event.notes && (
            <p className="whitespace-pre-wrap text-[16px] text-ink-secondary">
              {event.notes}
            </p>
          )}
        </Card>
      )}

      {event.type === "medical" && doctors.length > 0 && (
        <Card>
          <CardTitle>{t("needCall")}</CardTitle>
          <ul className="mt-2 flex flex-col gap-2">
            {doctors.map((d, i) => (
              <li key={i}>
                <a
                  href={`tel:${d.phone!.replace(/\s+/g, "")}`}
                  className="flex min-h-touch items-center justify-between rounded-md border border-line px-3.5 hover:bg-primary-soft"
                >
                  <span className="text-[16px] text-ink">
                    <b>{d.name}</b>
                    {d.specialty && (
                      <span className="text-ink-secondary">
                        {" "}
                        · {d.specialty}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-primary">
                    <Phone size={18} /> {tShell("call")}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <EventAdminButtons
        circleId={circleId}
        eventId={eventId}
        completed={!!event.completed_at}
        canEdit={canEdit}
      />
    </div>
  );
}
