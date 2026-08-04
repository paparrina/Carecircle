import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { nextOccurrence, todayInCircleTZ } from "@/lib/dates";
import { ProfileForm } from "@/components/circle/profile-form";
import { ImportantDates, type ImportantDateItem } from "@/components/circle/important-dates";
import { CheckinHistory } from "@/components/circle/checkin-history";
import { Card, CardTitle } from "@/components/ui/card";
import type { Doctor, EmergencyContact } from "@/components/circle/types";

export default async function ProfilePage({
  params
}: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const t = await getTranslations("profile");
  const supabase = await createClient();
  const today = todayInCircleTZ();
  const weekAgoISO = new Date(Date.now() - 7 * 86400000).toISOString();

  const [{ data: recipient }, membership, { data: dates }, { data: checkins }] = await Promise.all([
    supabase
      .from("care_recipients")
      .select(
        "full_name, birth_date, phone, allergies, conditions, notes, emergency_contacts, doctors"
      )
      .eq("circle_id", circleId)
      .limit(1)
      .maybeSingle(),
    supabase.auth.getUser().then(({ data: { user } }) =>
      supabase
        .from("circle_members")
        .select("role")
        .eq("circle_id", circleId)
        .eq("user_id", user?.id ?? "")
        .maybeSingle()
    ),
    supabase
      .from("important_dates")
      .select("id, title, date, type, recurring")
      .eq("circle_id", circleId),
    supabase
      .from("location_checkins")
      .select("place, place_label, created_at, by:checked_by(full_name)")
      .eq("circle_id", circleId)
      .gte("created_at", weekAgoISO)
      .order("created_at", { ascending: false })
      .limit(30)
  ]);
  if (!recipient) notFound();

  const canEdit =
    membership?.data?.role === "coordinator" ||
    membership?.data?.role === "member";

  const dateItems: ImportantDateItem[] = (dates ?? [])
    .map((d) => {
      const next = nextOccurrence(d.date, d.recurring, today);
      return {
        id: d.id as string,
        title: d.title as string,
        date: d.date as string,
        type: d.type as ImportantDateItem["type"],
        recurring: !!d.recurring,
        nextDate: next.date,
        daysUntil: next.daysUntil
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const checkinItems = (checkins ?? []).map((c) => {
    const by = Array.isArray(c.by) ? c.by[0] : c.by;
    return {
      place: c.place as string,
      placeLabel: c.place_label as string | null,
      byName: by?.full_name?.split(" ")[0] ?? "",
      at: c.created_at as string
    };
  });

  const extras = (
    <>
      <ImportantDates circleId={circleId} items={dateItems} canEdit={canEdit} />
      <CheckinHistory items={checkinItems} />
    </>
  );

  const contacts = (recipient.emergency_contacts ?? []) as EmergencyContact[];
  const doctors = (recipient.doctors ?? []) as Doctor[];

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-ink">
          {t("title", { name: recipient.full_name.split(" ")[0] })}
        </h1>
        <Card>
          <CardTitle>{t("basic")}</CardTitle>
          <p className="mt-2 text-lg text-ink">{recipient.full_name}</p>
          {recipient.phone && (
            <p className="text-[16px] text-ink-secondary">{recipient.phone}</p>
          )}
          {(recipient.allergies as string[]).length > 0 && (
            <p className="mt-2 text-[16px] text-ink">
              <span className="font-semibold">{t("allergies")}:</span>{" "}
              {(recipient.allergies as string[]).join(", ")}
            </p>
          )}
          {(recipient.conditions as string[]).length > 0 && (
            <p className="text-[16px] text-ink">
              <span className="font-semibold">{t("conditions")}:</span>{" "}
              {(recipient.conditions as string[]).join(", ")}
            </p>
          )}
          {recipient.notes && (
            <p className="mt-2 text-[16px] text-ink-secondary">
              {recipient.notes}
            </p>
          )}
        </Card>
        <Card>
          <CardTitle>{t("contacts")}</CardTitle>
          <ul className="mt-2 flex flex-col gap-1.5">
            {contacts.map((c, i) => (
              <li key={i} className="text-[16px] text-ink">
                <span className="font-medium">{c.name}</span>
                {c.relation && (
                  <span className="text-ink-secondary"> · {c.relation}</span>
                )}{" "}
                — {c.phone}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>{t("doctors")}</CardTitle>
          <ul className="mt-2 flex flex-col gap-1.5">
            {doctors.map((d, i) => (
              <li key={i} className="text-[16px] text-ink">
                <span className="font-medium">{d.name}</span>
                {d.specialty && (
                  <span className="text-ink-secondary"> · {d.specialty}</span>
                )}
                {d.phone && <> — {d.phone}</>}
              </li>
            ))}
          </ul>
        </Card>
        {extras}
        <p className="text-center text-[14px] text-ink-secondary">
          {t("viewerNote")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-ink">
        {t("title", { name: recipient.full_name.split(" ")[0] })}
      </h1>
      <ProfileForm
        circleId={circleId}
        initial={{
          fullName: recipient.full_name,
          birthDate: recipient.birth_date ?? "",
          phone: recipient.phone ?? "",
          allergies: (recipient.allergies as string[]).join(", "),
          conditions: (recipient.conditions as string[]).join(", "),
          notes: recipient.notes ?? "",
          contacts,
          doctors
        }}
      />
      {extras}
    </div>
  );
}
