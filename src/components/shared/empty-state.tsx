import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  text,
  ctaLabel,
  ctaHref
}: {
  icon: LucideIcon;
  text: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon size={28} strokeWidth={1.75} />
      </div>
      <p className="text-[17px] text-ink-secondary">{text}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="inline-flex min-h-touch items-center rounded-md bg-primary px-5 text-[17px] font-medium text-white hover:bg-primary-dark"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
