"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, CircleAlert, Minus } from "lucide-react";
import { logDose, undoDose } from "@/lib/meds/actions";
import type { TodayDose } from "@/lib/meds/queries";
import { cn } from "@/lib/utils";
import { todayInCircleTZ } from "@/lib/dates";

function nowHHMM() {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

export function TodayDoseList({
  circleId,
  date,
  doses,
  compact = false
}: {
  circleId: string;
  date: string;
  doses: TodayDose[];
  compact?: boolean;
}) {
  const t = useTranslations("meds");
  const locale = useLocale();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    text: string;
    undo?: () => void;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  function showToast(text: string, undo?: () => void) {
    setToast({ text, undo });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 10000);
  }

  function register(dose: TodayDose, status: "taken" | "skipped") {
    setPendingId(dose.scheduleId);
    startTransition(async () => {
      const res = await logDose({
        circleId,
        scheduleId: dose.scheduleId,
        medicationId: dose.medicationId,
        dueDate: date,
        status
      });
      setPendingId(null);
      if (res.logId) {
        const logId = res.logId;
        showToast(
          status === "taken" ? t("doseSaved") : t("doseSkipped"),
          () => {
            setToast(null);
            startTransition(async () => {
              await undoDose(circleId, logId);
              router.refresh();
            });
          }
        );
      } else if (res.error === "conflict") {
        showToast(t("alreadyLogged"));
      } else if (res.error) {
        showToast(t("genericError"));
      }
      router.refresh();
    });
  }

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(iso));

  const isLate = (time: string) => !compact && (date < todayInCircleTZ() || time < nowHHMM());

  return (
    <div className="relative">
      <ul>
        {doses.map((d) => {
          const late = !d.log && isLate(d.time);
          return (
            <li
              key={d.scheduleId}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b border-line py-3 last:border-0 sm:flex sm:items-start"
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  d.log?.status === "taken" &&
                    "bg-success-soft text-success",
                  d.log?.status === "skipped" && "bg-line text-ink-secondary",
                  !d.log && late && "bg-warning-soft text-warning",
                  !d.log && !late && "bg-[#EEF1F3] text-ink-secondary"
                )}
              >
                {d.log?.status === "taken" ? (
                  <Check size={18} strokeWidth={3} />
                ) : d.log?.status === "skipped" ? (
                  <Minus size={18} />
                ) : late ? (
                  <CircleAlert size={18} />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-current" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <span className="block text-lg font-bold tabular-nums text-ink">
                  {d.time}
                </span>
                <span
                  className={cn(
                    "block break-words text-base",
                    d.log?.status === "taken"
                      ? "text-ink-secondary"
                      : "font-medium text-ink"
                  )}
                >
                  {d.name}
                </span>
                <span className="block break-words text-sm text-ink-secondary">
                  {d.dosage}
                </span>
                <span
                  className={cn(
                    "block break-words text-sm",
                    late ? "font-medium text-[#805510]" : "text-ink-secondary"
                  )}
                >
                  {d.log
                    ? d.log.status === "taken"
                      ? t("takenBy", { name: d.log.byName, time: fmtTime(d.log.at) })
                      : t("skippedBy", { name: d.log.byName })
                    : d.assignedName
                      ? t("responsible", { name: d.assignedName })
                      : t("pendingAt")}
                </span>
              </div>

              {!d.log && (
                <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:shrink-0 sm:flex-col sm:items-end">
                  <button
                    onClick={() => register(d, "taken")}
                    disabled={pendingId === d.scheduleId}
                    className="min-h-touch max-w-full break-words rounded-md bg-primary-dark px-3.5 py-1 text-[15px] font-semibold text-white hover:bg-ink disabled:opacity-50"
                  >
                    {t("markTaken")}
                  </button>
                  {!compact && (
                    <button
                      onClick={() => register(d, "skipped")}
                      disabled={pendingId === d.scheduleId}
                      className="min-h-touch min-w-[48px] px-2 text-sm font-medium text-ink-secondary underline underline-offset-2"
                    >
                      {t("skip")}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center justify-between rounded-md bg-ink px-4 py-3 text-[15px] text-white shadow-lg"
        >
          {toast.text}
          {toast.undo && (
            <button
              onClick={toast.undo}
              className="ml-4 min-h-touch font-semibold text-[#9FD3C2] underline underline-offset-2"
            >
              {t("undo")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
