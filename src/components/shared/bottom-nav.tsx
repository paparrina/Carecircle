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
  { key: "meds", segment: "meds", icon: Pill },
  { key: "docs", segment: "docs", icon: FolderOpen },
  { key: "wall", segment: "wall", icon: MessagesSquare }
] as const;

export function BottomNav({ circleId }: { circleId: string }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label="Principal"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map(({ key, segment, icon: Icon }) => {
          const href = `/app/${circleId}/${segment}`;
          const active = pathname.startsWith(href);
          return (
            <li key={key} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[13px] font-medium",
                  active ? "text-primary" : "text-ink-secondary hover:text-ink"
                )}
              >
                <Icon size={26} strokeWidth={active ? 2.25 : 1.75} />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
