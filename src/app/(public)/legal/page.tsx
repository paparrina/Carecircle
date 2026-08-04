import { getTranslations } from "next-intl/server";

export default async function LegalPage() {
  const t = await getTranslations("legal");
  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-2xl font-semibold text-ink">{t("title")}</h1>
      <p className="mt-3 text-lg text-ink-secondary">{t("text")}</p>
    </main>
  );
}
