import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";

export default async function Page() {
  const t = await getTranslations("accountSettings");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <Card>
        <p className="text-ink-secondary">{t("scope")}</p>
        <Link className="inline-flex min-h-touch items-center font-semibold text-primary-dark underline" href="/account">
          {t("openAccount")}
        </Link>
      </Card>
    </div>
  );
}
