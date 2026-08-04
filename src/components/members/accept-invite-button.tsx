"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/lib/members/actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const t = useTranslations("invitePage");
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() => start(() => acceptInvitation(token))}
    >
      {t("join")}
    </Button>
  );
}
