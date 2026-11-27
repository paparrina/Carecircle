"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Sun,
  CalendarDays,
  Pill,
  FolderOpen,
  MessagesSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { key: "home", segment: "home", icon: Sun },
  { key: "calendar", segment: "calendar", icon: CalendarDays },
  { key: "meds", shortKey: "medsShort", segment: "meds", icon: Pill },
  { key: "docs", shortKey: "docsShort", segment: "docs", icon: FolderOpen },
  { key: "wall", segment: "wall", icon: MessagesSquare }
] as const;

export function BottomNav({ circleId }: { circleId: string }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label={t("label")}
    >
      <ul className="mx-auto flex max-w-md">
        {items.map((item) => {
          const { key, segment, icon: Icon } = item;
          const href = `/app/${circleId}/${segment}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={key} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[60px] flex-col items-center justify-center gap-1 px-0.5 text-center text-[11px] font-medium leading-tight min-[360px]:text-xs",
                  active ? "font-semibold text-primary" : "text-ink-secondary hover:text-ink"
                )}
              >
                <Icon size={25} aria-hidden strokeWidth={active ? 2.25 : 1.75} />
                {"shortKey" in item ? (
                  <>
                    <span className="min-[400px]:hidden">{t(item.shortKey)}</span>
                    <span className="hidden min-[400px]:inline">{t(key)}</span>
                  </>
                ) : t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
