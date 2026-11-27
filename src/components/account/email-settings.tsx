"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { saveEmailPreference } from "@/lib/account/preferences";

export function EmailSettings({ enabled }: { enabled: boolean }) {
  const t = useTranslations("accountSettings");
  const [checked, setChecked] = useState(enabled);
  const [result, setResult] = useState<boolean | null>(null);
  const [pending, start] = useTransition();
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      setResult(null);
      start(async () => setResult(await saveEmailPreference(checked)));
    }}>
      <label className="flex min-h-touch items-center gap-3">
        <input type="checkbox" checked={checked} disabled={pending}
          onChange={(event) => { setChecked(event.target.checked); setResult(null); }}
          className="h-5 w-5 accent-primary" />
        {t("email")}
      </label>
      <Button type="submit" disabled={pending}>{t(pending ? "saving" : "save")}</Button>
      {result !== null && <p role={result ? "status" : "alert"}
        className={result ? "mt-2 text-success" : "mt-2 text-danger"}>{t(result ? "saved" : "error")}</p>}
    </form>
  );
}
