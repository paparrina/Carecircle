"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCircle, type ActionState } from "@/lib/circle/actions";

export default function NewCirclePage() {
  const t = useTranslations("newCircle");
  const tc = useTranslations("auth");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createCircle,
    null
  );
  const year = new Date().getFullYear();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-[1.75rem] font-semibold leading-tight text-ink">
        {t("title")}
      </h1>
      <p className="mt-2 text-lg text-ink-secondary">{t("subtitle")}</p>

      <form action={action} className="mt-8 flex flex-col gap-5">
        <div>
          <Label htmlFor="recipientName">{t("nameLabel")}</Label>
          <Input
            id="recipientName"
            name="recipientName"
            placeholder={t("namePlaceholder")}
            required
            minLength={2}
            maxLength={80}
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="birthYear">{t("birthLabel")}</Label>
          <Input
            id="birthYear"
            name="birthYear"
            type="number"
            inputMode="numeric"
            min={1900}
            max={year}
            placeholder="1950"
          />
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-surface p-4">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-1 h-6 w-6 shrink-0 accent-primary"
          />
          <span className="text-[16px] leading-snug text-ink">
            {t("consent")}{" "}
            <Link
              href="/legal"
              target="_blank"
              className="text-primary underline underline-offset-2"
            >
              Cómo protegemos los datos →
            </Link>
          </span>
        </label>
        {state?.error && (
          <p role="alert" className="text-[16px] font-medium text-danger">
            {tc("errorGeneric")}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("creating") : t("create")}
        </Button>
      </form>
    </main>
  );
}
