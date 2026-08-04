"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteEvent, setEventCompleted } from "@/lib/events/actions";

export function EventAdminButtons({
  circleId,
  eventId,
  completed,
  canEdit
}: {
  circleId: string;
  eventId: string;
  completed: boolean;
  canEdit: boolean;
}) {
  const t = useTranslations("calendar");
  const [pending, start] = useTransition();

  if (!canEdit) return null;

  return (
    <div className="flex flex-col gap-3">
      <Button
        size="lg"
        variant={completed ? "secondary" : "primary"}
        disabled={pending}
        onClick={() =>
          start(() => setEventCompleted(circleId, eventId, !completed))
        }
      >
        {completed ? (
          <>
            <Undo2 size={22} /> {t("markUndone")}
          </>
        ) : (
          <>
            <Check size={22} /> {t("markDone")}
          </>
        )}
      </Button>
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (confirm(t("confirmDelete")))
            start(() => deleteEvent(circleId, eventId));
        }}
      >
        {t("delete")}
      </Button>
    </div>
  );
}
