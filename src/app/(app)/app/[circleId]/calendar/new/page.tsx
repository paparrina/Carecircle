import { getTranslations } from "next-intl/server";
import { getMembers } from "@/lib/circle/queries";
import { createEvent } from "@/lib/events/actions";
import { EventForm } from "@/components/calendar/event-form";
import { todayInCircleTZ } from "@/lib/dates";

export default async function NewEventPage({
  params
}: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const t = await getTranslations("calendar.form");
  const members = await getMembers(circleId);

  return (
    <EventForm
      circleId={circleId}
      title={t("titleNew")}
      action={createEvent}
      members={members}
      initial={{
        title: "",
        type: "medical",
        date: todayInCircleTZ(),
        time: "10:00",
        endTime: "",
        location: "",
        notes: "",
        assignedTo: "",
        reminders: [1440, 60]
      }}
    />
  );
}
