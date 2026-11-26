"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { archiveMedication, setMedicationActive } from "@/lib/meds/actions";

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
  const [archiveError, setArchiveError] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-3">
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
          if (!confirm(t("confirmArchive"))) return;
          setArchiveError(false);
          start(async () => {
            const result = await archiveMedication(circleId, medicationId);
            if (result?.error) setArchiveError(true);
          });
        }}
      >
        {t("archive")}
      </Button>
      {archiveError && <p role="alert" className="basis-full text-danger">{t("archiveError")}</p>}
    </div>
  );
}
