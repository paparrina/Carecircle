import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";

export default async function CircleSelectorPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("circle_members")
    .select("circle_id, role, care_circles(name)")
    .eq("user_id", user.id)
    .order("joined_at");

  if (!memberships || memberships.length === 0) redirect("/app/new");
  if (memberships.length === 1)
    redirect(`/app/${memberships[0].circle_id}/home`);

  const t = await getTranslations("circleSelector");

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="text-2xl font-semibold text-ink">{t("title")}</h1>
      <p className="mt-1 text-[17px] text-ink-secondary">{t("subtitle")}</p>
      <ul className="mt-6 flex flex-col gap-3">
        {memberships.map((m) => {
          const circle = Array.isArray(m.care_circles)
            ? m.care_circles[0]
            : m.care_circles;
          return (
            <li key={m.circle_id}>
              <Link href={`/app/${m.circle_id}/home`}>
                <Card className="flex min-h-cta items-center justify-between hover:bg-primary-soft">
                  <span className="text-lg font-medium text-ink">
                    {circle?.name}
                  </span>
                  <ChevronRight className="text-ink-secondary" />
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href="/app/new"
        className="mt-6 inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-md border border-line text-[17px] font-medium text-primary hover:bg-primary-soft"
      >
        <Plus size={20} /> {t("new")}
      </Link>
    </main>
  );
}
