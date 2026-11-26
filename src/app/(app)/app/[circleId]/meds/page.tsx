import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Pill, Plus, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTodayDoses } from "@/lib/meds/queries";
import { TodayDoseList } from "@/components/meds/today-list";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export default async function MedsPage({
  params,
  searchParams
}: {
  params: Promise<{ circleId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { circleId } = await params;
  const { tab } = await searchParams;
  const showAll = tab === "all";
  const t = await getTranslations("meds");
  const supabase = await createClient();

  const tabs = (
    <div className="mb-4 flex rounded-md border border-line bg-surface p-1">
      {[
        { href: `/app/${circleId}/meds`, label: t("tabToday"), on: !showAll },
        {
          href: `/app/${circleId}/meds?tab=all`,
          label: t("tabAll"),
          on: showAll
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

  const addFab = (
    <Link
      href={`/app/${circleId}/meds/new`}
      className="fixed bottom-24 right-4 z-30 flex min-h-cta items-center gap-2 rounded-full bg-primary px-5 text-[17px] font-semibold text-white shadow-lg hover:bg-primary-dark"
    >
      <Plus size={22} /> {t("add")}
    </Link>
  );

  if (!showAll) {
    const { date, doses } = await getTodayDoses(circleId);
    const done = doses.filter((d) => d.log).length;
    return (
      <div>
        {tabs}
        <Card>
          <div className="flex items-baseline justify-between">
            <h1 className="text-[15px] font-semibold uppercase tracking-wide text-ink-secondary">
              {t("title")}
            </h1>
            {doses.length > 0 && (
              <span className="text-[15px] font-semibold text-primary">
                {t("progress", { done, total: doses.length })}
              </span>
            )}
          </div>
          {doses.length === 0 ? (
            <EmptyState
              icon={Pill}
              text={t("emptyToday")}
              ctaLabel={t("add")}
              ctaHref={`/app/${circleId}/meds/new`}
            />
          ) : (
            <>
              {done === doses.length && (
                <p className="mt-2 rounded-md bg-success-soft px-3 py-2 text-[15px] font-medium text-success">
                  {t("allDone")}
                </p>
              )}
              <TodayDoseList circleId={circleId} date={date} doses={doses} />
            </>
          )}
        </Card>
        {addFab}
      </div>
    );
  }

  const { data: meds } = await supabase
    .from("medications")
    .select(
      "id, name, dosage, instructions, active, archived_at, assigned:assigned_to(full_name), medication_schedules(time_of_day)"
    )
    .eq("circle_id", circleId)
    .is("medication_schedules.retired_at", null)
    .order("active", { ascending: false })
    .order("name");

  return (
    <div>
      {tabs}
      {!meds || meds.length === 0 ? (
        <Card>
          <EmptyState
            icon={Pill}
            text={t("emptyAll")}
            ctaLabel={t("emptyAllCta")}
            ctaHref={`/app/${circleId}/meds/new`}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {meds.map((m) => {
            const assigned = Array.isArray(m.assigned)
              ? m.assigned[0]
              : m.assigned;
            const times = (m.medication_schedules ?? [])
              .map((s) => (s.time_of_day as string).slice(0, 5))
              .sort();
            return (
              <li key={m.id}>
                <Link href={`/app/${circleId}/meds/${m.id}`}>
                  <Card
                    className={cn(
                      "hover:border-primary",
                      !m.active && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-lg font-semibold text-ink">
                        {m.name}
                        {!m.active && (
                          <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[13px] font-medium text-ink-secondary">
                            {t(m.archived_at ? "archived" : "inactive")}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-[16px] text-ink-secondary">{m.dosage}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {times.map((x) => (
                        <span
                          key={x}
                          className="rounded-full bg-primary-soft px-2.5 py-1 text-[14px] font-semibold text-primary-dark"
                        >
                          {x}
                        </span>
                      ))}
                      {assigned?.full_name && (
                        <span className="ml-1 inline-flex items-center gap-1 text-[14px] text-ink-secondary">
                          <User size={16} /> {assigned.full_name.split(" ")[0]}
                        </span>
                      )}
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {addFab}
    </div>
  );
}
