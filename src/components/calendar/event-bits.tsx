import { CalendarDays, Home, ListChecks, Stethoscope } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const EVENT_ICON: Record<string, LucideIcon> = {
  medical: Stethoscope,
  visit: Home,
  task: ListChecks,
  other: CalendarDays
};

export const EVENT_TINT: Record<string, string> = {
  medical: "bg-primary-soft text-primary-dark",
  visit: "bg-mint-soft text-[#2E6B57]",
  task: "bg-warning-soft text-warning",
  other: "bg-line/60 text-ink-secondary"
};
