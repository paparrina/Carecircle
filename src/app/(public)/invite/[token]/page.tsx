import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { AcceptInviteButton } from "@/components/members/accept-invite-button";

type InviteInfo = {
  valid: boolean;
  role?: "member" | "viewer";
  circle_name?: string;
  recipient_name?: string;
  inviter_name?: string;
};

export default async function InvitePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("invitePage");
  const tm = await getTranslations("members");
  const supabase = await createClient();

  const [{ data: info }, { data: auth }] = await Promise.all([
    supabase.rpc("get_invitation_info", { p_token: token }),
    supabase.auth.getUser()
  ]);
  const invite = (info ?? { valid: false }) as InviteInfo;
  const user = auth?.user ?? null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Image
        src="/icons/icon-192.png"
        alt=""
        width={72}
        height={72}
        className="mb-5 self-center rounded-2xl"
      />
      <h1 className="text-center text-2xl font-semibold text-ink">
        {t("title")}
      </h1>

      {!invite.valid ? (
        <Card className="mt-6 text-center">
          <p className="text-lg text-ink">{t("invalid")}</p>
          <p className="mt-1 text-[16px] text-ink-secondary">{t("askNew")}</p>
        </Card>
      ) : (
        <>
          <p className="mt-3 text-center text-lg leading-relaxed text-ink-secondary">
            {t("text", {
              inviter: invite.inviter_name ?? "",
              recipient: invite.recipient_name ?? ""
            })}
          </p>
          <p className="mt-2 text-center text-[16px] font-medium text-primary-dark">
            {t("asRole", {
              role: tm(`roleNames.${invite.role ?? "member"}` as "roleNames.member")
            })}
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {user ? (
              <AcceptInviteButton token={token} />
            ) : (
              <>
                <p className="text-center text-[16px] text-ink-secondary">
                  {t("needAccount")}
                </p>
                <Link
                  href={`/signup?next=/invite/${token}`}
                  className="inline-flex min-h-cta items-center justify-center rounded-md bg-primary px-6 text-lg font-semibold text-white hover:bg-primary-dark"
                >
                  {t("signup")}
                </Link>
                <Link
                  href={`/login?next=/invite/${token}`}
                  className="inline-flex min-h-touch items-center justify-center rounded-md text-[17px] font-medium text-primary-dark hover:bg-primary-soft"
                >
                  {t("login")}
                </Link>
                <p className="text-center text-[14px] text-ink-secondary">
                  {t("afterSignup")}
                </p>
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}
