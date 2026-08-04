"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, X } from "lucide-react";
import { revokeInvitation } from "@/lib/members/actions";

export function InvitationRow({
  circleId,
  id,
  email,
  role,
  url,
  expiresLabel
}: {
  circleId: string;
  id: string;
  email: string | null;
  role: string;
  url: string;
  expiresLabel: string;
}) {
  const t = useTranslations("members");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium text-ink">
          {email ?? t("pendingLink")}
        </span>
        <span className="block text-[13.5px] text-ink-secondary">
          {t(`roleNames.${role}` as "roleNames.member")} · {expiresLabel}
        </span>
      </span>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
        aria-label={t("copyLink")}
        className="flex h-11 min-w-[44px] items-center justify-center gap-1 rounded-md bg-primary-soft px-2.5 text-[14px] font-semibold text-primary-dark"
      >
        <Copy size={17} /> {copied ? "✓" : ""}
      </button>
      <button
        onClick={() => start(() => revokeInvitation(circleId, id))}
        disabled={pending}
        aria-label={t("revoke")}
        className="flex h-11 w-11 items-center justify-center rounded-md text-danger hover:bg-danger/10"
      >
        <X size={20} />
      </button>
    </li>
  );
}
