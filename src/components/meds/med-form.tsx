"use client";

import { preserveForm } from "@/lib/preserve-form";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Clock, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MedFormState } from "@/lib/meds/actions";
import { cn } from "@/lib/utils";

export type Member = { id: string; name: string };
export type MedFormValues = {
  name: string;
  dosage: string;
  instructions: string;
  times: string[];
  days: number[];
  assignedTo: string;
};

const PRESETS: { key: "morning" | "midday" | "night"; time: string }[] = [
  { key: "morning", time: "08:00" },
  { key: "midday", time: "14:00" },
  { key: "night", time: "21:00" }
];

export function MedForm({
  circleId,
  members,
  initial,
  action,
  title
}: {
  circleId: string;
  members: Member[];
  initial?: MedFormValues;
  action: (prev: MedFormState, fd: FormData) => Promise<MedFormState>;
  title: string;
}) {
  const t = useTranslations("meds.form");
  const tc = useTranslations("auth");
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initial?.name ?? "");
  const [dosage, setDosage] = useState(initial?.dosage ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [times, setTimes] = useState<string[]>(initial?.times ?? []);
  const [days, setDays] = useState<number[]>(
    initial?.days ?? [1, 2, 3, 4, 5, 6, 7]
  );
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? "");
  const [customTime, setCustomTime] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<MedFormState, FormData>(
    action,
    null
  );

  const dayInitials = t("dayInitials").split(",");

  function toggleTime(time: string) {
    setStepError(null);
    setTimes((ts) =>
      ts.includes(time) ? ts.filter((x) => x !== time) : [...ts, time].sort()
    );
  }
  function toggleDay(d: number) {
    setStepError(null);
    setDays((ds) =>
      ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()
    );
  }
  function next() {
    if (step === 1 && (name.trim().length < 2 || dosage.trim().length < 1))
      return;
    if (step === 2) {
      if (times.length === 0) return setStepError(t("needTime"));
      if (days.length === 0) return setStepError(t("needDay"));
    }
    setStep((s) => s + 1);
  }

  return (
    <form onSubmit={preserveForm(formAction)} className="flex flex-col gap-5">
      <input type="hidden" name="circleId" value={circleId} />
      {times.map((time) => (
        <input key={time} type="hidden" name="times" value={time} />
      ))}
      {days.map((d) => (
        <input key={d} type="hidden" name="days" value={d} />
      ))}
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="dosage" value={dosage} />
      <input type="hidden" name="instructions" value={instructions} />
      <input type="hidden" name="assignedTo" value={assignedTo} />

      <div>
        <p className="text-[14px] font-semibold uppercase tracking-wide text-primary">
          {t("step", { n: step })}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{title}</h1>
      </div>

      {step === 1 && (
        <>
          <div>
            <Label htmlFor="f-name">{t("name")}</Label>
            <Input
              id="f-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePh")}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="f-dosage">{t("dosage")}</Label>
            <Input
              id="f-dosage"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder={t("dosagePh")}
            />
          </div>
          <div>
            <Label htmlFor="f-instr">{t("instructions")}</Label>
            <Input
              id="f-instr"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t("instructionsPh")}
            />
          </div>
          <Button
            type="button"
            size="lg"
            onClick={next}
            disabled={name.trim().length < 2 || dosage.trim().length < 1}
          >
            {t("next")}
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <div>
            <Label>{t("whenTitle")}</Label>
            <div className="flex flex-col gap-2">
              {PRESETS.map(({ key, time }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleTime(time)}
                  className={cn(
                    "flex min-h-cta items-center justify-between rounded-md border px-4 text-[17px] font-medium",
                    times.includes(time)
                      ? "border-primary bg-primary-soft text-primary-dark"
                      : "border-line bg-surface text-ink"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <Clock size={22} strokeWidth={1.75} /> {t(key)}
                  </span>
                  <span className="font-bold">{time}</span>
                </button>
              ))}
              {times
                .filter((x) => !PRESETS.some((p) => p.time === x))
                .map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => toggleTime(time)}
                    className="flex min-h-cta items-center justify-between rounded-md border border-primary bg-primary-soft px-4 text-[17px] font-medium text-primary-dark"
                  >
                    <span className="flex items-center gap-2.5">
                      <Clock size={22} strokeWidth={1.75} /> {time}
                    </span>
                    <X size={20} />
                  </button>
                ))}
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="flex-1"
                  aria-label={t("addTime")}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="w-auto shrink-0 px-4"
                  onClick={() => {
                    if (customTime) {
                      toggleTime(customTime);
                      setCustomTime("");
                    }
                  }}
                >
                  <Plus size={20} /> {t("addTime")}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label>{t("daysTitle")}</Label>
            <div className="flex gap-1.5">
              {dayInitials.map((ini, idx) => {
                const d = idx + 1;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={days.includes(d)}
                    onClick={() => toggleDay(d)}
                    className={cn(
                      "h-12 flex-1 rounded-md border text-[16px] font-semibold",
                      days.includes(d)
                        ? "border-primary bg-primary text-white"
                        : "border-line bg-surface text-ink-secondary"
                    )}
                  >
                    {ini}
                  </button>
                );
              })}
            </div>
          </div>

          {stepError && (
            <p role="alert" className="text-[16px] font-medium text-danger">
              {stepError}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              className="w-auto flex-1"
              onClick={() => setStep(1)}
            >
              {t("back")}
            </Button>
            <Button type="button" className="w-auto flex-[2]" onClick={next}>
              {t("next")}
            </Button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div>
            <Label>{t("whoTitle")}</Label>
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

          {state?.error && (
            <p role="alert" className="text-[16px] font-medium text-danger">
              {tc("errorGeneric")}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              className="w-auto flex-1"
              onClick={() => setStep(2)}
            >
              {t("back")}
            </Button>
            <Button
              type="submit"
              size="lg"
              className="w-auto flex-[2]"
              disabled={pending}
            >
              {t("save")}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
