import { getTranslations } from "next-intl/server";

export async function useRelativeServer() {
  const t = await getTranslations("shell");
  return (iso: string) => {
    const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return t("justNow");
    if (diffMin < 60) return t("minutesAgo", { min: diffMin });
    const h = Math.floor(diffMin / 60);
    if (h < 24) return t("hoursAgo", { h });
    return t("daysAgo", { d: Math.floor(h / 24) });
  };
}
