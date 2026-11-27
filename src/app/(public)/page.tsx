import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowDown, ArrowRight, CalendarDays, Clock3, FolderLock, HeartHandshake, Pill } from "lucide-react";
import { setLandingLanguage } from "./landing-language";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: `Acompasa — ${t("heroTitle")}`,
    description: t("heroText"),
    robots: { index: false, follow: false }
  };
}

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const locale = await getLocale();
  const features = [
    { icon: Pill, title: t("point1Title"), text: t("point1Text") },
    { icon: CalendarDays, title: t("point2Title"), text: t("point2Text") },
    { icon: FolderLock, title: t("point3Title"), text: t("point3Text") }
  ];

  return (
    <div className="min-h-dvh bg-[#fbf9f3] text-[#193b35]">
      <header className="border-b border-[#dedfd3]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-3 sm:px-8 lg:px-12">
          <Link href="/" className="inline-flex min-h-touch items-center gap-2 text-xl font-bold tracking-tight">
            <span className="rounded-xl bg-[#193b35] p-2 text-white"><HeartHandshake size={21} aria-hidden /></span>
            Acompasa
          </Link>
          <form action={setLandingLanguage} aria-label={t("language")} className="flex items-center gap-1">
            {(["es", "en"] as const).map((language) => (
              <button key={language} type="submit" name="locale" value={language}
                lang={language} aria-label={language === "es" ? "Español" : "English"}
                aria-pressed={locale === language}
                className={`min-h-touch min-w-[48px] rounded-lg px-2 text-sm font-semibold ${locale === language ? "bg-[#e6ebe2]" : "hover:bg-[#efeee7]"}`}>
                {language.toUpperCase()}
              </button>
            ))}
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <section className="grid items-center gap-8 pb-12 pt-10 md:grid-cols-[1fr_1.05fr] md:gap-10 lg:pb-20 lg:pt-16">
          <div>
            <h1 className="max-w-[13ch] font-serif text-[clamp(2.5rem,5.8vw,4.65rem)] font-medium leading-[1.02] tracking-[-.04em]">
              {t("heroTitle")}
            </h1>
            <p className="mt-5 max-w-[43ch] text-base leading-relaxed text-[#405850] sm:text-lg">
              {t("heroText")}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link href="/login" className="inline-flex min-h-touch items-center justify-center gap-2 rounded-xl bg-[#193b35] px-5 py-3 text-sm font-semibold text-white hover:bg-[#28534b]">
                {t("cta")} <ArrowRight size={18} aria-hidden />
              </Link>
              <a href="#features" className="inline-flex min-h-touch items-center gap-2 text-sm font-semibold underline underline-offset-4">
                {t("ctaSecondary")} <ArrowDown size={17} aria-hidden />
              </a>
            </div>
            <p className="mt-4 text-sm text-[#405850]">{t("beta")}</p>
          </div>
          <div className="relative isolate aspect-[6/5] overflow-hidden rounded-[1.5rem] bg-[#dfebe1] sm:aspect-[7/5]">
            <Image src="/brand/acompasa-family.webp" fill priority
              sizes="(min-width: 768px) 50vw, 100vw" className="object-cover object-center" alt={t("photoAlt")} />
            <div className="absolute bottom-3 left-3 right-3 flex max-w-[19rem] items-center gap-3 rounded-xl bg-[#fffffb] p-3 shadow-lg sm:bottom-5 sm:left-5">
              <span className="shrink-0 rounded-lg bg-[#e6ede3] p-2"><Clock3 size={20} aria-hidden /></span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#405850]">{t("sampleLabel")}</p>
                <p className="break-words text-sm font-bold">{t("sampleEvent")}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-5 border-t border-[#dedfd3] py-10 lg:py-14">
          <h2 className="font-serif text-3xl tracking-tight sm:text-4xl">{t("featuresTitle")}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-[#dedfd3] bg-[#fffffb] p-5">
                <span className="inline-flex rounded-lg bg-[#e6ede3] p-2.5"><Icon size={22} aria-hidden /></span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#405850]">{text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dedfd3]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 px-5 py-5 text-sm text-[#405850] sm:px-8 lg:px-12">
          <p>{t("disclaimer")}</p>
          <Link href="/legal" className="inline-flex min-h-touch items-center underline underline-offset-4">{t("privacy")}</Link>
        </div>
      </footer>
    </div>
  );
}
