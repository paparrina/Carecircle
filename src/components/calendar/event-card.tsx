import Link from "next/link";
import { Check, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EVENT_ICON, EVENT_TINT } from "./event-bits";
import type { EventItem } from "@/lib/events/queries";
import { cn } from "@/lib/utils";

export function EventCard({
  circleId,
  event,
  assignedLabel
}: {
  circleId: string;
  event: EventItem;
  assignedLabel: (name: string) => string;
}) {
  const Icon = EVENT_ICON[event.type];
  return (
    <Link href={`/app/${circleId}/calendar/${event.id}`}>
      <Card
        className={cn(
          "flex items-center gap-3 hover:border-primary",
          event.completed && "opacity-60"
        )}
      >
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-md",
            EVENT_TINT[event.type]
          )}
        >
          {event.completed ? (
            <Check size={24} strokeWidth={2.5} />
          ) : (
            <Icon size={24} strokeWidth={1.75} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[17px] font-semibold",
              event.completed ? "text-ink-secondary line-through" : "text-ink"
            )}
          >
            {event.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[14.5px] text-ink-secondary">
            {event.location && <span className="truncate">{event.location}</span>}
            {event.assignedName && (
              <span className="inline-flex items-center gap-1">
                <User size={15} /> {assignedLabel(event.assignedName)}
              </span>
            )}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-lg font-bold text-ink">{event.time}</span>
          {event.endTime && (
            <span className="block text-[13px] text-ink-secondary">
              – {event.endTime}
            </span>
          )}
        </span>
      </Card>
    </Link>
  );
}
