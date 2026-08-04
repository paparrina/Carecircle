import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMembers } from "@/lib/circle/queries";
import { updateEvent } from "@/lib/events/actions";
import { EventForm } from "@/components/calendar/event-form";
import { dateInCircleTZ, timeInCircleTZ } from "@/lib/dates";

export default async function EditEventPage({
  params
}: {
  params: Promise<{ circleId: string; eventId: string }>;
}) {
  const { circleId, eventId } = await params;
  const t = await getTranslations("calendar.form");
  const supabase = await createClient();

  const [{ data: event }, members] = await Promise.all([
    supabase
      .from("events")
      .select(
        "title, type, starts_at, ends_at, location, notes, assigned_to, reminder_minutes"
      )
      .eq("id", eventId)
      .eq("circle_id", circleId)
      .maybeSingle(),
    getMembers(circleId)
  ]);
  if (!event) notFound();

  const boundAction = updateEvent.bind(null, eventId);

  return (
    <EventForm
      circleId={circleId}
      title={t("titleEdit")}
      action={boundAction}
      members={members}
      initial={{
        title: event.title,
        type: event.type,
        date: dateInCircleTZ(event.starts_at),
        time: timeInCircleTZ(event.starts_at),
        endTime: event.ends_at ? timeInCircleTZ(event.ends_at) : "",
        location: event.location ?? "",
        notes: event.notes ?? "",
        assignedTo: event.assigned_to ?? "",
        reminders: (event.reminder_minutes as number[]) ?? []
      }}
    />
  );
}
