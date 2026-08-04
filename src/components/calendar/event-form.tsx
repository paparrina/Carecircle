"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EVENT_ICON } from "./event-bits";
import type { EventFormState } from "@/lib/events/actions";
import type { CircleMember } from "@/lib/circle/queries";
import { cn } from "@/lib/utils";

export type EventFormValues = {
  title: string;
  type: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  notes: string;
  assignedTo: string;
  reminders: number[];
};

const TYPES = ["medical", "visit", "task", "other"] as const;
const REMINDERS = [1440, 60];

export function EventForm({
  circleId,
  members,
  initial,
  action,
  title
}: {
  circleId: string;
  members: CircleMember[];
  initial?: EventFormValues;
  action: (prev: EventFormState, fd: FormData) => Promise<EventFormState>;
  title: string;
}) {
  const t = useTranslations("calendar.form");
  const tt = useTranslations("calendar.types");
  const tc = useTranslations("auth");
  const [type, setType] = useState(initial?.type ?? "medical");
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? "");
  const [reminders, setReminders] = useState<number[]>(
    initial?.reminders ?? [1440, 60]
  );
  const [state, formAction, pending] = useActionState<EventFormState, FormData>(
    action,
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="circleId" value={circleId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="assignedTo" value={assignedTo} />
      {reminders.map((r) => (
        <input key={r} type="hidden" name="reminders" value={r} />
      ))}

      <h1 className="text-2xl font-semibold text-ink">{title}</h1>

      <div>
        <Label htmlFor="e-title">{t("title")}</Label>
        <Input
          id="e-title"
          name="title"
          defaultValue={initial?.title}
          placeholder={t("titlePh")}
          required
          minLength={2}
          autoFocus
        />
      </div>

      <div>
        <Label>{t("type")}</Label>
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((x) => {
            const Icon = EVENT_ICON[x];
            return (
              <button
                key={x}
                type="button"
                onClick={() => setType(x)}
                className={cn(
                  "flex min-h-cta items-center gap-2.5 rounded-md border px-3 text-[16px] font-medium",
                  type === x
                    ? "border-primary bg-primary-soft text-primary-dark"
                    : "border-line bg-surface text-ink"
                )}
              >
                <Icon size={22} strokeWidth={1.75} /> {tt(x)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="e-date">{t("date")}</Label>
          <Input
            id="e-date"
            name="date"
            type="date"
            defaultValue={initial?.date}
            required
          />
        </div>
        <div>
          <Label htmlFor="e-time">{t("time")}</Label>
          <Input
            id="e-time"
            name="time"
            type="time"
            defaultValue={initial?.time}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="e-end">{t("endTime")}</Label>
        <Input
          id="e-end"
          name="endTime"
          type="time"
          defaultValue={initial?.endTime}
        />
      </div>

      <div>
        <Label htmlFor="e-loc">{t("location")}</Label>
        <Input
          id="e-loc"
          name="location"
          defaultValue={initial?.location}
          placeholder={t("locationPh")}
        />
      </div>

      <div>
        <Label>{t("who")}</Label>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setAssignedTo("")}
            className={cn(
              "min-h-touch rounded-md border px-4 text-left text-[17px]",
              assignedTo === ""
                ? "border-primary bg-primary-soft font-medium text-primary-dark"
                : "border-line bg-surface text-ink"
            )}
          >
            {t("nobody")}
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setAssignedTo(m.id)}
              className={cn(
                "min-h-touch rounded-md border px-4 text-left text-[17px]",
                assignedTo === m.id
                  ? "border-primary bg-primary-soft font-medium text-primary-dark"
                  : "border-line bg-surface text-ink"
              )}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>{t("reminders")}</Label>
        <div className="flex gap-2">
          {REMINDERS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={reminders.includes(r)}
              onClick={() =>
                setReminders((rs) =>
                  rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]
                )
              }
              className={cn(
                "min-h-touch flex-1 rounded-md border text-[16px] font-medium",
                reminders.includes(r)
                  ? "border-primary bg-primary-soft text-primary-dark"
                  : "border-line bg-surface text-ink"
              )}
            >
              {t(`r${r}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="e-notes">{t("notes")}</Label>
        <textarea
          id="e-notes"
          name="notes"
          defaultValue={initial?.notes}
          rows={3}
          className="w-full rounded-md border border-line bg-surface p-3 text-lg text-ink focus:border-primary focus:outline focus:outline-2 focus:outline-primary/30"
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-[16px] font-medium text-danger">
          {tc("errorGeneric")}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
