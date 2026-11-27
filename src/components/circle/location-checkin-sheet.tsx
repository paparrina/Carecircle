"use client";

import { preserveForm } from "@/lib/preserve-form";

import {
  Home,
  Building2,
  Stethoscope,
  Footprints,
  PenLine
} from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BottomSheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logCheckin, type ActionState } from "@/lib/circle/actions";
import { cn } from "@/lib/utils";

const places = [
  { value: "home", icon: Home },
  { value: "day_center", icon: Building2 },
  { value: "doctor", icon: Stethoscope },
  { value: "walk", icon: Footprints },
  { value: "other", icon: PenLine }
] as const;

export function LocationCheckinSheet({
  open,
  onClose,
  circleId,
  recipientName
}: {
  open: boolean;
  onClose: () => void;
  circleId: string;
  recipientName: string;
}) {
  const t = useTranslations("checkin");
  const [selected, setSelected] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    logCheckin,
    null
  );

  // Cerrar al guardar con éxito
  useEffect(() => {
    if (!pending && state === null && selected) {
      setSelected(null);
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("title", { name: recipientName })}
    >
      <form onSubmit={preserveForm(formAction)} className="flex flex-col gap-3">
        <input type="hidden" name="circleId" value={circleId} />
        <div className="grid grid-cols-2 gap-2">
          {places.map(({ value, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                "flex min-h-cta cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2",
                selected === value
                  ? "border-primary bg-primary-soft text-primary-dark"
                  : "border-line bg-surface text-ink hover:bg-background"
              )}
            >
              <input
                type="radio"
                name="place"
                value={value}
                className="sr-only"
                onChange={() => setSelected(value)}
                required
              />
              <Icon size={24} strokeWidth={1.75} />
              <span className="text-[17px] font-medium">{t(value)}</span>
            </label>
          ))}
        </div>
        {selected === "other" && (
          <Input
            name="placeLabel"
            placeholder={t("otherPlaceholder")}
            maxLength={80}
            autoFocus
          />
        )}
        <Button type="submit" size="lg" disabled={pending || !selected}>
          {t("confirm")}
        </Button>
      </form>
    </BottomSheet>
  );
}
