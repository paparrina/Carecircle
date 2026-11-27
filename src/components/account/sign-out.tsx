"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { unregisterPush } from "@/lib/account/push";

export function SignOut() {
  const t = useTranslations("common");
  const [pending, start] = useTransition();
  return (
    <form className="mt-6" action={signOut} onSubmit={(event) => {
      event.preventDefault();
      start(async () => {
        try {
          const registration = await navigator.serviceWorker?.getRegistration();
          const subscription = await registration?.pushManager.getSubscription();
          if (subscription) {
            await unregisterPush(subscription.endpoint);
            await subscription.unsubscribe();
          }
        } catch {}
        await signOut();
      });
    }}>
      <Button type="submit" variant="secondary" disabled={pending}>{t("signOut")}</Button>
    </form>
  );
}
