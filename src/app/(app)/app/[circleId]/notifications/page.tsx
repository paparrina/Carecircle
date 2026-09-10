import {
  AtSign,
  Bell,
  Cake,
  CalendarClock,
  FileText,
  MessagesSquare,
  Pill,
  UserPlus
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { MarkRead } from "@/components/shared/mark-read";
import { getRelativeServer } from "@/components/shared/relative-server";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  event_reminder: CalendarClock,
  med_missed: Pill,
  important_date: Cake,
  new_post: MessagesSquare,
  new_comment: MessagesSquare,
  mention: AtSign,
  doc_uploaded: FileText,
  member_joined: UserPlus
};

export default async function NotificationsPage({
  params
}: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const t = await getTranslations("notif");
  const rel = await getRelativeServer();
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: notifs } = await supabase
    .from("notifications")
    .select("id, type, payload, read_at, created_at")
    .eq("user_id", user?.id ?? "")
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })
    .limit(50);

  const whenLabel = (days: number) =>
    days === 0 ? t("today") : days === 1 ? t("tomorrow") : t("inDays", { d: days });

  const text = (type: string, p: Record<string, unknown>) => {
    try {
      if (type === "med_missed" && p.escalated)
        return t("types.med_missed_escalated", {
          med: String(p.med ?? ""),
          time: String(p.time ?? "")
        });
      if (type === "important_date")
        return t("types.important_date", {
          title: String(p.title ?? ""),
          when: whenLabel(Number(p.days ?? 0))
        });
      return t(`types.${type}` as "types.new_post", {
        title: String(p.title ?? ""),
        time: String(p.time ?? ""),
        med: String(p.med ?? ""),
        author: String(p.author ?? ""),
        excerpt: String(p.excerpt ?? ""),
        doc: String(p.doc ?? ""),
        name: String(p.name ?? "")
      });
    } catch {
      return type;
    }
  };

  return (
    <div>
      <MarkRead circleId={circleId} />
      <h1 className="mb-4 text-2xl font-semibold text-ink">{t("title")}</h1>
      {!notifs || notifs.length === 0 ? (
        <Card>
          <EmptyState icon={Bell} text={t("empty")} />
        </Card>
      ) : (
        <Card>
          <ul>
            {notifs.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              const unread = !n.read_at;
              return (
                <li
                  key={n.id}
                  className="flex items-start gap-3 border-b border-line py-3.5 last:border-0"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      unread
                        ? "bg-primary-soft text-primary-dark"
                        : "bg-line/50 text-ink-secondary"
                    )}
                  >
                    <Icon size={19} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-[15.5px] leading-snug",
                        unread ? "font-medium text-ink" : "text-ink-secondary"
                      )}
                    >
                      {text(n.type, (n.payload ?? {}) as Record<string, unknown>)}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-secondary">
                      {rel(n.created_at)}
                    </span>
                  </span>
                  {unread && (
                    <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
