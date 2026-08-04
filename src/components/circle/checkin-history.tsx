import { getLocale, getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";

export async function CheckinHistory({
  items
}: {
  items: {
    place: string;
    placeLabel: string | null;
    byName: string;
    at: string;
  }[];
}) {
  const t = await getTranslations("checkinHistory");
  const tPlaces = await getTranslations("places");
  const locale = await getLocale();

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Madrid"
    }).format(new Date(iso));

  return (
    <Card>
      <CardTitle>{t("title")}</CardTitle>
      {items.length === 0 ? (
        <p className="mt-2 text-[15.5px] text-ink-secondary">{t("empty")}</p>
      ) : (
        <ul className="mt-1">
          {items.map((c, i) => (
            <li
              key={i}
              className="flex items-center gap-2.5 border-b border-line py-2.5 text-[15.5px] last:border-0"
            >
              <MapPin size={17} className="shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-ink">
                <b>
                  {c.place === "other"
                    ? (c.placeLabel ?? "")
                    : tPlaces(c.place as "home")}
                </b>{" "}
                <span className="text-ink-secondary">({c.byName})</span>
              </span>
              <span className="shrink-0 text-[13.5px] capitalize text-ink-secondary">
                {fmt(c.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
