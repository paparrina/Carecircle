"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deleteAccount } from "@/lib/account/delete";
import { Button } from "@/components/ui/button";

export function DeleteAccount() {
  const t = useTranslations("accountSettings");
  const [result, action, pending] = useActionState(deleteAccount, null);
  return (
    <details className="mt-3 border-t border-line pt-3">
      <summary className="min-h-touch cursor-pointer font-semibold text-danger">{t("delete")}</summary>
      <p className="mb-2 text-sm text-ink-secondary">{t("deleteScope")}</p>
      <form action={action}>
        <label className="flex min-h-touch items-center gap-3">
          <input type="checkbox" name="confirm" required className="h-5 w-5 accent-primary" />
          {t("deleteConfirmation")}
        </label>
        <Button type="submit" variant="danger" disabled={pending}>{t(pending ? "deleting" : "delete")}</Button>
        {result === false && <p role="alert" className="mt-2 text-danger">{t("deleteBlocked")}</p>}
      </form>
    </details>
  );
}
