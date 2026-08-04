import { Hammer } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function ModulePlaceholder({ task }: { task: string }) {
  const t = await getTranslations("placeholder");
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning-soft text-warning">
        <Hammer size={28} strokeWidth={1.75} />
      </div>
      <h1 className="text-xl font-semibold text-ink">{t("title")}</h1>
      <p className="max-w-xs text-[17px] text-ink-secondary">
        {t("text", { task })}
      </p>
    </div>
  );
}
