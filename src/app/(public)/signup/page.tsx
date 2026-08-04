"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleIcon } from "@/components/shared/google-icon";
import { loginWithGoogle, signup, type AuthState } from "@/lib/auth/actions";

export default function SignupPage() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signup,
    null
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Image src="/icons/icon-192.png" alt="" width={64} height={64} className="mb-4 self-start rounded-2xl" />
      <h1 className="mb-8 text-[1.75rem] font-semibold text-ink">
        {t("signupTitle")}
      </h1>

      <form action={loginWithGoogle}>
        <Button type="submit" variant="secondary" size="lg">
          <GoogleIcon /> {t("google")}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[15px] text-ink-secondary">
        <span className="h-px flex-1 bg-line" /> {t("or")}
        <span className="h-px flex-1 bg-line" />
      </div>

      <form action={action} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="fullName">{t("fullName")}</Label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            minLength={2}
          />
        </div>
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
        {state?.message && (
          <p
            role="status"
            className="rounded-md bg-success-soft p-3 text-center text-[16px] font-medium text-success"
          >
            {t("signupSuccess")}
          </p>
        )}
        {state?.error && (
          <p role="alert" className="text-[16px] font-medium text-danger">
            {t("errorGeneric")}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {t("signupButton")}
        </Button>
      </form>

      <p className="mt-8 text-center text-[16px] text-ink-secondary">
        {t("hasAccount")}{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline underline-offset-2"
        >
          {t("goLogin")}
        </Link>
      </p>
    </main>
  );
}
