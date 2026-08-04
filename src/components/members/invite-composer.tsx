"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { createInvitation } from "@/lib/members/actions";
import { cn } from "@/lib/utils";

export function InviteComposer({
  circleId,
  recipientFirstName
}: {
  circleId: string;
  recipientFirstName: string;
}) {
  const t = useTranslations("members");
  const tc = useTranslations("auth");
  const [role, setRole] = useState<"member" | "viewer">("member");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function copyLink() {
    start(async () => {
      const res = await createInvitation({ circleId, role });
      if (res.url) {
        const text = t("waMessage", { name: recipientFirstName, url: res.url });
        try {
          await navigator.clipboard.writeText(text);
          setMsg({ kind: "ok", text: t("copied") });
        } catch {
          setMsg({ kind: "warn", text: res.url });
        }
      } else setMsg({ kind: "err", text: tc("errorGeneric") });
    });
  }

  function sendByEmail() {
    if (!email) return;
    start(async () => {
      const res = await createInvitation({ circleId, role, email });
      if (res.error) return setMsg({ kind: "err", text: tc("errorGeneric") });
      if (res.emailSent) {
        setMsg({ kind: "ok", text: t("emailSent", { email }) });
        setEmail("");
      } else if (res.url) {
        try {
          await navigator.clipboard.writeText(res.url);
        } catch {}
        setMsg({ kind: "warn", text: t("emailNotConfigured") });
      }
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">{t("inviteTitle")}</h2>
      <p className="mt-0.5 text-[15px] text-ink-secondary">
        {t("inviteSubtitle")}
      </p>

      <div className="mt-4">
        <Label>{t("inviteRole")}</Label>
        <div className="flex flex-col gap-2">
          {(["member", "viewer"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn(
                "rounded-md border px-4 py-3 text-left",
                role === r
                  ? "border-primary bg-primary-soft"
                  : "border-line bg-surface"
              )}
            >
              <span
                className={cn(
                  "block text-[16px] font-semibold",
                  role === r ? "text-primary-dark" : "text-ink"
                )}
              >
                {t(`roleNames.${r}`)}
              </span>
              <span className="block text-[14px] text-ink-secondary">
                {t(`roleHints.${r}`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Button size="lg" className="mt-4" disabled={pending} onClick={copyLink}>
        <Link2 size={22} /> {t("copyLink")}
      </Button>

      <div className="mt-5">
        <Label htmlFor="inv-email">{t("emailLabel")}</Label>
        <div className="flex gap-2">
          <Input
            id="inv-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPh")}
          />
          <Button
            variant="secondary"
            className="w-auto shrink-0 px-4"
            disabled={pending || !email}
            onClick={sendByEmail}
          >
            <Mail size={20} /> {t("sendEmail")}
          </Button>
        </div>
      </div>

      {msg && (
        <p
          role="status"
          className={cn(
            "mt-4 break-all rounded-md p-3 text-[15px] font-medium",
            msg.kind === "ok" && "bg-success-soft text-success",
            msg.kind === "warn" && "bg-warning-soft text-warning",
            msg.kind === "err" && "bg-danger/10 text-danger"
          )}
        >
          {msg.text}
        </p>
      )}
    </Card>
  );
}
