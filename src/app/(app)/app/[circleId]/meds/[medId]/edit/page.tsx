import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MedForm } from "@/components/meds/med-form";
import { updateMedication } from "@/lib/meds/actions";

export default async function EditMedPage({
  params
}: {
  params: Promise<{ circleId: string; medId: string }>;
}) {
  const { circleId, medId } = await params;
  const t = await getTranslations("meds.form");
  const supabase = await createClient();

  const [{ data: med }, { data: members }] = await Promise.all([
    supabase
      .from("medications")
      .select(
        "name, dosage, instructions, assigned_to, medication_schedules(time_of_day, days_of_week)"
      )
      .eq("id", medId)
      .eq("circle_id", circleId)
      .is("medication_schedules.retired_at", null)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("circle_members")
      .select("user_id, profiles:user_id(full_name)")
      .eq("circle_id", circleId)
  ]);
  if (!med) notFound();

  const schedules = med.medication_schedules ?? [];
  const boundAction = updateMedication.bind(null, medId);

  return (
    <MedForm
      circleId={circleId}
      title={t("titleEdit")}
      action={boundAction}
      initial={{
        name: med.name,
        dosage: med.dosage,
        instructions: med.instructions ?? "",
        times: schedules
          .map((s) => (s.time_of_day as string).slice(0, 5))
          .sort(),
        days: (schedules[0]?.days_of_week as number[]) ?? [1, 2, 3, 4, 5, 6, 7],
        assignedTo: med.assigned_to ?? ""
      }}
      members={(members ?? []).map((m) => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return { id: m.user_id as string, name: p?.full_name ?? "" };
      })}
    />
  );
}
