"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Cake, CalendarClock, Heart, IdCard, Plus, Star, Trash2 } from "lucide-react";
import {
  createImportantDate,
  deleteImportantDate
} from "@/lib/important-dates/actions";
import { BottomSheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type ImportantDateItem = {
  id: string;
  title: string;
  date: string;
  type: "birthday" | "anniversary" | "expiry" | "other";
  recurring: boolean;
  nextDate: string;
  daysUntil: number;
};

export const DATE_ICON: Record<string, LucideIcon> = {
  birthday: Cake,
  anniversary: Heart,
  expiry: IdCard,
  other: Star
};

export function daysLabel(
  t: ReturnType<typeof useTranslations<"importantDates">>,
  d: number
) {
  if (d === 0) return t("today");
  if (d === 1) return t("tomorrow");
  return t("inDays", { d });
}

export function ImportantDates({
  circleId,
  items,
  canEdit
}: {
  circleId: string;
  items: ImportantDateItem[];
  canEdit: boolean;
}) {
  const t = useTranslations("importantDates");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] =
    useState<ImportantDateItem["type"]>("birthday");
  const [recurring, setRecurring] = useState(true);
  const [reminds, setReminds] = useState<number[]>([7, 1]);
  const [pending, start] = useTransition();

  function pickType(x: ImportantDateItem["type"]) {
    setType(x);
    setRecurring(x === "birthday" || x === "anniversary");
  }

  function save() {
    start(async () => {
      const res = await createImportantDate({
        circleId,
        title,
        date,
        type,
        recurring,
        remindDaysBefore: reminds
      });
      if (!res.error) {
        setOpen(false);
        setTitle("");
        setDate("");
      }
    });
  }

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      ...(iso.slice(0, 4) !== String(new Date().getFullYear())
        ? { year: "numeric" }
        : {}),
      timeZone: "Europe/Madrid"
    }).format(new Date(`${iso}T12:00:00`));

  return (
    <Card>
      <CardTitle>{t("title")}</CardTitle>
      {items.length === 0 ? (
        <p className="mt-2 text-[15.5px] text-ink-secondary">{t("empty")}</p>
      ) : (
        <ul className="mt-1">
          {items.map((d) => {
            const Icon = DATE_ICON[d.type];
            const soon = d.daysUntil <= 7;
            return (
              <li
                key={d.id}
                className="flex items-center gap-3 border-b border-line py-3 last:border-0"
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                    soon
                      ? "bg-warning-soft text-warning"
                      : "bg-primary-soft text-primary-dark"
                  )}
                >
                  <Icon size={21} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-medium text-ink">
                    {d.title}
                  </span>
                  <span className="block text-[14px] text-ink-secondary">
                    {fmt(d.nextDate)}
                    {d.recurring && " · ↻"}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[13.5px] font-semibold",
                    soon
                      ? "bg-warning-soft text-warning"
                      : "bg-line/60 text-ink-secondary"
                  )}
                >
                  {daysLabel(t, d.daysUntil)}
                </span>
                {canEdit && (
                  <button
                    onClick={() => {
                      if (confirm(t("confirmDelete", { name: d.title })))
                        start(() => deleteImportantDate(circleId, d.id));
                    }}
                    disabled={pending}
                    aria-label={t("delete")}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:text-danger"
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => setOpen(true)}
        >
          <Plus size={20} /> {t("add")}
        </Button>
      )}

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("formTitle")}
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="d-title">{t("name")}</Label>
            <Input
              id="d-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("namePh")}
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="d-date">{t("date")}</Label>
            <Input
              id="d-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("type")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["birthday", "anniversary", "expiry", "other"] as const).map(
                (x) => {
                  const Icon = DATE_ICON[x];
                  return (
                    <button
                      key={x}
                      type="button"
                      onClick={() => pickType(x)}
                      className={cn(
                        "flex min-h-touch items-center gap-2 rounded-md border px-3 text-[15.5px] font-medium",
                        type === x
                          ? "border-primary bg-primary-soft text-primary-dark"
                          : "border-line bg-surface text-ink"
                      )}
                    >
                      <Icon size={19} strokeWidth={1.75} /> {t(`types.${x}`)}
                    </button>
                  );
                }
              )}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line p-3.5">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="h-6 w-6 accent-primary"
            />
            <span className="flex items-center gap-2 text-[16px] font-medium text-ink">
              <CalendarClock size={19} className="text-primary" />
              {t("recurring")}
            </span>
          </label>
          <div>
            <Label>{t("remind")}</Label>
            <div className="flex gap-2">
              {[7, 1].map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reminds.includes(r)}
                  onClick={() =>
                    setReminds((rs) =>
                      rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]
                    )
                  }
                  className={cn(
                    "min-h-touch flex-1 rounded-md border text-[15.5px] font-medium",
                    reminds.includes(r)
                      ? "border-primary bg-primary-soft text-primary-dark"
                      : "border-line bg-surface text-ink"
                  )}
                >
                  {t(`r${r}` as "r7")}
                </button>
              ))}
            </div>
          </div>
          <Button
            size="lg"
            disabled={pending || title.trim().length < 2 || !date}
            onClick={save}
          >
            {t("save")}
          </Button>
        </div>
      </BottomSheet>
    </Card>
  );
}
