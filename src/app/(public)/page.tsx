import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Pill, CalendarDays, FolderOpen } from "lucide-react";
import { Card } from "@/components/ui/card";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tc = await getTranslations("common");

  const points = [
    { icon: Pill, title: t("point1Title"), text: t("point1Text") },
    { icon: CalendarDays, title: t("point2Title"), text: t("point2Text") },
    { icon: FolderOpen, title: t("point3Title"), text: t("point3Text") }
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-[calc(2rem+env(safe-area-inset-top))]">
      <div className="mb-8 flex justify-center">
        <Image
          src="/brand/logo-full.png"
          alt={tc("appName")}
          width={220}
          height={201}
          priority
        />
      </div>

      <h1 className="text-center text-[2rem] font-semibold leading-[1.15] tracking-tight text-ink">
        {t("heroTitle")}
      </h1>
      <p className="mt-4 text-center text-lg leading-relaxed text-ink-secondary">
        {t("heroText")}
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/signup"
          className="inline-flex min-h-cta items-center justify-center rounded-md bg-primary px-6 text-lg font-medium text-white hover:bg-primary-dark"
        >
          {t("cta")}
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-touch items-center justify-center rounded-md text-[17px] font-medium text-primary-dark hover:bg-primary-soft"
        >
          {t("ctaSecondary")}
        </Link>
      </div>

      <div className="mt-12 flex flex-col gap-3">
        {points.map(({ icon: Icon, title, text }) => (
          <Card key={title} className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon size={24} strokeWidth={1.75} />
            </span>
            <span>
              <span className="block text-[17px] font-semibold text-ink">
                {title}
              </span>
              <span className="mt-0.5 block text-[16px] leading-snug text-ink-secondary">
                {text}
              </span>
            </span>
          </Card>
        ))}
      </div>

      <p className="mt-auto pt-12 text-center text-[14px] leading-relaxed text-ink-secondary">
        {t("disclaimer")}
      </p>
    </main>
  );
}
