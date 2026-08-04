"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, MapPin, Phone, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { QuickCallSheet } from "./quick-call-sheet";
import { LocationCheckinSheet } from "./location-checkin-sheet";
import type { LatestCheckin, RecipientHeader } from "./types";

function useRelativeTime(iso: string | undefined) {
  const t = useTranslations("shell");
  return useMemo(() => {
    if (!iso) return "";
    const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return t("justNow");
    if (diffMin < 60) return t("minutesAgo", { min: diffMin });
    const h = Math.floor(diffMin / 60);
    if (h < 24) return t("hoursAgo", { h });
    return t("daysAgo", { d: Math.floor(h / 24) });
  }, [iso, t]);
}

export function CircleHeader({
  circleId,
  recipient,
  recipientPhone,
  latestCheckin,
  unreadCount = 0
}: {
  circleId: string;
  recipient: RecipientHeader;
  recipientPhone?: string;
  latestCheckin: LatestCheckin;
  unreadCount?: number;
}) {
  const t = useTranslations("shell");
  const tPlaces = useTranslations("places");
  const locale = useLocale();
  const [callOpen, setCallOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const relative = useRelativeTime(latestCheckin?.at);

  const today = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date());

  const placeText = latestCheckin
    ? latestCheckin.place === "other"
      ? latestCheckin.placeLabel ?? ""
      : tPlaces(latestCheckin.place)
    : t("locationUnknown");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <Link
          href={`/app/${circleId}/profile`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {recipient.photoUrl ? (
            <Image
              src={recipient.photoUrl}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-semibold text-white"
            >
              {recipient.name.charAt(0)}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-xl font-semibold leading-tight text-ink">
              {recipient.name}
              {recipient.age !== null && (
                <span className="font-normal text-ink-secondary">
                  , {recipient.age}
                </span>
              )}
            </span>
            <span className="block text-[15px] capitalize text-ink-secondary">
              {today}
            </span>
          </span>
        </Link>
        <button
          onClick={() => setCallOpen(true)}
          aria-label={t("call")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary hover:bg-[#dbe9e5]"
        >
          <Phone size={24} />
        </button>
        <Link
          href={`/app/${circleId}/notifications`}
          aria-label={t("notifications")}
          className="relative flex h-12 w-12 items-center justify-center rounded-full text-ink-secondary hover:bg-primary-soft hover:text-primary"
        >
          <Bell size={24} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      </div>

      <div className="mx-auto flex max-w-md items-center gap-2 px-4 pb-2.5">
        <MapPin size={18} className="shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[15px] text-ink-secondary">
          {latestCheckin ? (
            <>
              <span className="font-medium text-ink">{placeText}</span>
              {" · "}
              {relative} ({latestCheckin.byName})
            </>
          ) : (
            placeText
          )}
        </p>
        <button
          onClick={() => setCheckinOpen(true)}
          aria-label={t("checkin")}
          className="flex min-h-[36px] items-center gap-1 rounded-full border border-line bg-surface px-3 text-[15px] font-medium text-primary hover:bg-primary-soft"
        >
          <Plus size={18} /> {t("checkin")}
        </button>
      </div>

      <QuickCallSheet
        open={callOpen}
        onClose={() => setCallOpen(false)}
        circleId={circleId}
        recipientName={recipient.name}
        recipientPhone={recipientPhone}
        contacts={recipient.emergencyContacts}
        doctors={recipient.doctors}
      />
      <LocationCheckinSheet
        open={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        circleId={circleId}
        recipientName={recipient.name}
      />
    </header>
  );
}
