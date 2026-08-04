"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { deleteMedication, setMedicationActive } from "@/lib/meds/actions";

export function MedAdminButtons({
  circleId,
  medicationId,
  active
}: {
  circleId: string;
  medicationId: string;
  active: boolean;
}) {
  const t = useTranslations("meds");
  const [pending, start] = useTransition();

  return (
    <div className="flex gap-3">
      <Button
        variant="secondary"
        className="w-auto flex-1"
        disabled={pending}
        onClick={() =>
          start(() => setMedicationActive(circleId, medicationId, !active))
        }
      >
        {active ? t("pause") : t("resume")}
      </Button>
      <Button
        variant="danger"
        className="w-auto flex-1"
        disabled={pending}
        onClick={() => {
          if (confirm(t("confirmDelete")))
            start(() => deleteMedication(circleId, medicationId));
        }}
      >
        {t("delete")}
      </Button>
    </div>
  );
}
