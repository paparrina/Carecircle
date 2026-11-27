"use client";

import { preserveForm } from "@/lib/preserve-form";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loginWithGoogle,
  loginWithPassword,
  sendMagicLink,
  type AuthState
} from "@/lib/auth/actions";
import { GoogleIcon } from "@/components/shared/google-icon";

function LoginForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";
  const account = useTranslations("accountSettings");
  const [pwState, pwAction, pwPending] = useActionState<AuthState, FormData>(
    loginWithPassword,
    null
  );
  const [mlState, mlAction, mlPending] = useActionState<AuthState, FormData>(
    sendMagicLink,
    null
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Image src="/icons/icon-192.png" alt="" width={64} height={64} className="mb-4 self-start rounded-2xl" />
      <h1 className="mb-8 text-[1.75rem] font-semibold text-ink">
        {t("loginTitle")}
      </h1>

      {params.get("accountDeleted") === "1" && <p role="status" className="mb-4 text-success">{account("deleted")}</p>}
      <form action={loginWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" size="lg">
          <GoogleIcon /> {t("google")}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[15px] text-ink-secondary">
        <span className="h-px flex-1 bg-line" /> {t("or")}
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={preserveForm(pwAction)} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
            autoComplete="current-password"
            required
          />
        </div>
        {pwState?.error && (
          <p role="alert" className="text-[16px] font-medium text-danger">
            {t("errorCredentials")}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pwPending}>
          {t("loginButton")}
        </Button>
      </form>

      <form action={mlAction} className="mt-4">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="ghost" disabled={mlPending || !email}>
          <Mail size={20} /> {t("magicLink")}
        </Button>
        <p className="mt-1 text-center text-[15px] text-ink-secondary">
          {t("magicLinkHint")}
        </p>
        {mlState?.message && (
          <p
            role="status"
            className="mt-2 rounded-md bg-success-soft p-3 text-center text-[16px] font-medium text-success"
          >
            {t("magicLinkSent")}
          </p>
        )}
        {mlState?.error && (
          <p role="alert" className="mt-2 text-center text-[16px] text-danger">
            {t("errorGeneric")}
          </p>
        )}
      </form>

      <p className="mt-8 text-center text-[16px] text-ink-secondary">
        {t("noAccount")}{" "}
        <Link
          href={next === "/app" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary underline underline-offset-2"
        >
          {t("goSignup")}
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
