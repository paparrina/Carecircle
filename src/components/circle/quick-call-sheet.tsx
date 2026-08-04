"use client";

import { Phone, Siren, Stethoscope, UserRound } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BottomSheet } from "@/components/ui/sheet";
import type { Doctor, EmergencyContact } from "./types";

function CallRow({
  icon,
  name,
  detail,
  phone
}: {
  icon: React.ReactNode;
  name: string;
  detail?: string;
  phone: string;
}) {
  const t = useTranslations("shell");
  return (
    <li>
      <a
        href={`tel:${phone.replace(/\s+/g, "")}`}
        className="flex min-h-cta items-center gap-3 rounded-md border border-line bg-surface px-4 py-2 hover:bg-primary-soft"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-medium text-ink">
            {name}
          </span>
          {detail && (
            <span className="block truncate text-[15px] text-ink-secondary">
              {detail}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5 font-medium text-primary">
          <Phone size={20} /> {t("call")}
        </span>
      </a>
    </li>
  );
}

export function QuickCallSheet({
  open,
  onClose,
  circleId,
  recipientName,
  recipientPhone,
  contacts,
  doctors
}: {
  open: boolean;
  onClose: () => void;
  circleId: string;
  recipientName: string;
  recipientPhone?: string;
  contacts: EmergencyContact[];
  doctors: Doctor[];
}) {
  const t = useTranslations("call");

  return (
    <BottomSheet open={open} onClose={onClose} title={t("title")}>
      <ul className="flex flex-col gap-2">
        {recipientPhone && (
          <CallRow
            icon={<UserRound size={22} />}
            name={recipientName}
            phone={recipientPhone}
          />
        )}
        <CallRow
          icon={<Siren size={22} />}
          name={t("emergency")}
          detail="112"
          phone="112"
        />
        {contacts.map((c, i) => (
          <CallRow
            key={`c-${i}`}
            icon={<UserRound size={22} />}
            name={c.name}
            detail={c.relation}
            phone={c.phone}
          />
        ))}
        {doctors
          .filter((d) => d.phone)
          .map((d, i) => (
            <CallRow
              key={`d-${i}`}
              icon={<Stethoscope size={22} />}
              name={d.name}
              detail={d.specialty}
              phone={d.phone!}
            />
          ))}
      </ul>
      <p className="mt-4 text-[15px] text-ink-secondary">
        {contacts.length === 0 && doctors.length === 0 && (
          <span className="mb-1 block">{t("empty")}</span>
        )}
        {t("editHint", { name: recipientName })}{" "}
        <Link
          href={`/app/${circleId}/profile`}
          onClick={onClose}
          className="font-medium text-primary underline underline-offset-2"
        >
          {t("goProfile")}
        </Link>
      </p>
    </BottomSheet>
  );
}
