import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MedForm } from "@/components/meds/med-form";
import { createMedication } from "@/lib/meds/actions";

export default async function NewMedPage({
  params
}: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const t = await getTranslations("meds.form");
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("circle_members")
    .select("user_id, profiles:user_id(full_name)")
    .eq("circle_id", circleId);

  return (
    <MedForm
      circleId={circleId}
      title={t("titleNew")}
      action={createMedication}
      members={(members ?? []).map((m) => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return { id: m.user_id as string, name: p?.full_name ?? "" };
      })}
    />
  );
}
