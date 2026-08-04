import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { lastNDates, weekdayInCircleTZ } from "@/lib/dates";
import { Card, CardTitle } from "@/components/ui/card";
import { MedAdminButtons } from "@/components/meds/med-admin-buttons";
import { cn } from "@/lib/utils";

export default async function MedDetailPage({
  params
}: {
  params: Promise<{ circleId: string; medId: string }>;
}) {
  const { circleId, medId } = await params;
  const t = await getTranslations("meds");
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: med }, { data: membership }] = await Promise.all([
    supabase
      .from("medications")
      .select(
        "id, name, dosage, instructions, active, assigned:assigned_to(full_name), medication_schedules(id, time_of_day, days_of_week)"
      )
      .eq("id", medId)
      .eq("circle_id", circleId)
      .maybeSingle(),
    supabase.auth.getUser().then(({ data: { user } }) =>
      supabase
        .from("circle_members")
        .select("role")
        .eq("circle_id", circleId)
        .eq("user_id", user?.id ?? "")
        .maybeSingle()
    )
  ]);
  if (!med) notFound();
  const canEdit =
    membership?.role === "coordinator" || membership?.role === "member";

  const days7 = lastNDates(7);
  const { data: logs } = await supabase
    .from("medication_logs")
    .select("due_date, status, schedule_id")
    .eq("medication_id", medId)
    .gte("due_date", days7[0]);

  const schedules = med.medication_schedules ?? [];
  const assigned = Array.isArray(med.assigned) ? med.assigned[0] : med.assigned;
  const dayInitials = (await getTranslations("meds.form"))("dayInitials").split(
    ","
  );

  // Adherencia por día: verde = todas registradas, ámbar = parcial, gris = ninguna/sin tomas
  const dots = days7.map((date) => {
    const wd = weekdayInCircleTZ(date);
    const dueCount = schedules.filter((s) =>
      (s.days_of_week as number[]).includes(wd)
    ).length;
    const dayLogs = (logs ?? []).filter(
      (l) => l.due_date === date && l.status === "taken"
    ).length;
    return {
      date,
      state:
        dueCount === 0
          ? "none"
          : dayLogs >= dueCount
            ? "full"
            : dayLogs > 0
              ? "partial"
              : "empty"
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {med.name}
            {!med.active && (
              <span className="ml-2 rounded-full bg-line px-2 py-0.5 align-middle text-[13px] font-medium text-ink-secondary">
                {t("inactive")}
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-lg text-ink-secondary">{med.dosage}</p>
          {med.instructions && (
            <p className="mt-1 text-[16px] text-ink-secondary">
              {med.instructions}
            </p>
          )}
          {assigned?.full_name && (
            <p className="mt-1 text-[16px] font-medium text-primary-dark">
              {t("responsible", { name: assigned.full_name.split(" ")[0] })}
            </p>
          )}
        </div>
        {canEdit && (
          <Link
            href={`/app/${circleId}/meds/${medId}/edit`}
            className="flex min-h-touch items-center gap-1.5 rounded-md bg-primary-soft px-3.5 text-[15px] font-semibold text-primary-dark"
          >
            <Pencil size={18} /> {t("edit")}
          </Link>
        )}
      </div>

      <Card>
        <CardTitle>{t("schedules")}</CardTitle>
        <ul className="mt-2 flex flex-col gap-2">
          {schedules
            .sort((a, b) =>
              (a.time_of_day as string).localeCompare(b.time_of_day as string)
            )
            .map((s) => {
              const days = s.days_of_week as number[];
              return (
                <li key={s.id} className="flex items-center justify-between">
                  <span className="text-xl font-bold text-ink">
                    {(s.time_of_day as string).slice(0, 5)}
                  </span>
                  <span className="text-[15px] text-ink-secondary">
                    {days.length === 7
                      ? t("everyDay")
                      : days.map((d) => dayInitials[d - 1]).join(" · ")}
                  </span>
                </li>
              );
            })}
        </ul>
      </Card>

      <Card>
        <CardTitle>{t("history7")}</CardTitle>
        <div className="mt-3 flex justify-between">
          {dots.map(({ date, state }) => (
            <div key={date} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "h-8 w-8 rounded-full",
                  state === "full" && "bg-success",
                  state === "partial" && "bg-warning",
                  state === "empty" && "border-2 border-line bg-surface",
                  state === "none" && "bg-line/50"
                )}
                title={date}
              />
              <span className="text-[12px] text-ink-secondary">
                {new Intl.DateTimeFormat(locale, {
                  weekday: "short",
                  timeZone: "Europe/Madrid"
                })
                  .format(new Date(`${date}T12:00:00`))
                  .slice(0, 2)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {canEdit && (
        <MedAdminButtons
          circleId={circleId}
          medicationId={medId}
          active={med.active}
        />
      )}
    </div>
  );
}
