"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { disablePush, registerPush, unregisterPush } from "@/lib/account/push";

export function PushSettings({ enabled, publicKey }: { enabled: boolean; publicKey?: string }) {
  const t = useTranslations("push");
  const [supported, setSupported] = useState(false);
  const [result, setResult] = useState<"saved" | "off" | "denied" | "error">();
  const [pending, start] = useTransition();
  useEffect(() => {
    const available = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(available);
    if (!available) return;
    const revoke = async () => {
      if (Notification.permission === "granted") return;
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription && await unregisterPush(subscription.endpoint)) await subscription.unsubscribe();
      } catch {}
    };
    void revoke();
    window.addEventListener("focus", revoke);
    return () => window.removeEventListener("focus", revoke);
  }, []);

  function enable() {
    start(async () => {
      try {
        if (!publicKey || await Notification.requestPermission() !== "granted") {
          setResult("denied");
          return;
        }
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration?.active) { setResult("error"); return; }
        const key = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
        const existing = await registration.pushManager.getSubscription();
        const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        setResult(await registerPush(subscription.toJSON()) ? "saved" : "error");
      } catch { setResult("error"); }
    });
  }

  function disable() {
    start(async () => {
      if (!await disablePush()) { setResult("error"); return; }
      try {
        if (supported) {
          const registration = await navigator.serviceWorker.getRegistration();
          const subscription = await registration?.pushManager.getSubscription();
          await subscription?.unsubscribe();
        }
      } catch {}
      setResult("off");
    });
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="font-semibold">{t("title")}</h3>
      <p className="my-2 text-sm text-ink-secondary">{t("description")}</p>
      {publicKey && supported ? (
        <Button disabled={pending} onClick={enable}>{t(pending ? "working" : "enable")}</Button>
      ) : <p className="text-sm text-ink-secondary">{t("unsupported")}</p>}
      {enabled && <Button className="mt-2" variant="secondary" disabled={pending} onClick={disable}>{t("disable")}</Button>}
      {result && <p role={result === "error" || result === "denied" ? "alert" : "status"}>{t(result)}</p>}
    </div>
  );
}
