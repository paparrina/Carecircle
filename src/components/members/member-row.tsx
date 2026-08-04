"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { removeMember, updateMemberRole } from "@/lib/members/actions";
import { cn } from "@/lib/utils";

const ROLE_TINT: Record<string, string> = {
  coordinator: "bg-primary-soft text-primary-dark",
  member: "bg-mint-soft text-[#2E6B57]",
  viewer: "bg-warning-soft text-warning"
};

export function MemberRow({
  circleId,
  rowId,
  name,
  role,
  isSelf,
  canManage
}: {
  circleId: string;
  rowId: string;
  name: string;
  role: string;
  isSelf: boolean;
  canManage: boolean;
}) {
  const t = useTranslations("members");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function changeRole(newRole: string) {
    setError(null);
    start(async () => {
      const res = await updateMemberRole({
        circleId,
        memberRowId: rowId,
        role: newRole as "coordinator" | "member" | "viewer"
      });
      if (res.error === "last_coordinator")
        setError(t("lastCoordinator"));
    });
  }

  function remove() {
    if (!confirm(t("confirmRemove", { name }))) return;
    setError(null);
    start(async () => {
      const res = await removeMember(circleId, rowId);
      if (res.error === "last_coordinator") setError(t("lastCoordinator"));
    });
  }

  return (
    <li className="flex flex-col gap-2 border-b border-line py-3.5 last:border-0">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
          {name.charAt(0)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-medium text-ink">
            {name}
            {isSelf && (
              <span className="text-ink-secondary"> ({t("you")})</span>
            )}
          </span>
        </span>
        {canManage ? (
          <>
            <select
              value={role}
              disabled={pending}
              onChange={(e) => changeRole(e.target.value)}
              aria-label={t("inviteRole")}
              className={cn(
                "min-h-touch rounded-md border-0 px-3 text-[15px] font-semibold",
                ROLE_TINT[role]
              )}
            >
              <option value="coordinator">{t("roleNames.coordinator")}</option>
              <option value="member">{t("roleNames.member")}</option>
              <option value="viewer">{t("roleNames.viewer")}</option>
            </select>
            {!isSelf && (
              <button
                onClick={remove}
                disabled={pending}
                aria-label={t("remove")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-danger hover:bg-danger/10"
              >
                <Trash2 size={20} />
              </button>
            )}
          </>
        ) : (
          <span
            className={cn(
              "rounded-full px-3 py-1.5 text-[14px] font-semibold",
              ROLE_TINT[role]
            )}
          >
            {t(`roleNames.${role}` as "roleNames.member")}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[14px] font-medium text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
