"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function OnboardingChecklist({
  circleId,
  hasMed,
  hasEvent,
  hasSecondMember,
  hasDoc
}: {
  circleId: string;
  hasMed: boolean;
  hasEvent: boolean;
  hasSecondMember: boolean;
  hasDoc: boolean;
}) {
  const t = useTranslations("onboarding");
  const key = `cc-checklist-${circleId}`;
  const [dismissed, setDismissed] = useState(true); // evita parpadeo SSR

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [key]);

  const steps = [
    { done: hasMed, label: t("step1"), href: `/app/${circleId}/meds/new` },
    { done: hasEvent, label: t("step2"), href: `/app/${circleId}/calendar/new` },
    { done: hasSecondMember, label: t("step3"), href: `/app/${circleId}/members` },
    { done: hasDoc, label: t("step4"), href: `/app/${circleId}/docs` }
  ];
  const allDone = steps.every((s) => s.done);
  if (dismissed || allDone) return null;

  return (
    <Card className="border-primary/40 bg-primary-soft/40">
      <div className="flex items-center justify-between">
        <CardTitle>{t("checklistTitle")}</CardTitle>
        <button
          onClick={() => {
            try {
              localStorage.setItem(key, "1");
            } catch {}
            setDismissed(true);
          }}
          aria-label={t("dismiss")}
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink-secondary hover:bg-surface"
        >
          <X size={18} />
        </button>
      </div>
      <ul className="mt-1.5 flex flex-col">
        {steps.map((s, i) => (
          <li key={i}>
            <Link
              href={s.href}
              className={cn(
                "flex min-h-touch items-center gap-3 rounded-md px-1",
                s.done ? "pointer-events-none" : "hover:bg-surface"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
                  s.done
                    ? "border-success bg-success text-white"
                    : "border-primary/50 bg-surface text-transparent"
                )}
              >
                <Check size={16} strokeWidth={3} />
              </span>
              <span
                className={cn(
                  "text-[16px]",
                  s.done
                    ? "text-ink-secondary line-through"
                    : "font-medium text-ink"
                )}
              >
                {s.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
