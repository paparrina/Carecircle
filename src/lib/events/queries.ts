import { createClient } from "@/lib/supabase/server";
import { dateInCircleTZ, timeInCircleTZ } from "@/lib/dates";

export type EventItem = {
  id: string;
  title: string;
  type: "medical" | "visit" | "task" | "other";
  date: string; // YYYY-MM-DD en Madrid
  time: string; // HH:MM
  endTime: string | null;
  location: string | null;
  assignedName: string | null;
  completed: boolean;
};

function mapEvent(e: {
  id: string;
  title: string;
  type: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  completed_at: string | null;
  assigned: { full_name: string } | { full_name: string }[] | null;
}): EventItem {
  const assigned = Array.isArray(e.assigned) ? e.assigned[0] : e.assigned;
  return {
    id: e.id,
    title: e.title,
    type: e.type as EventItem["type"],
    date: dateInCircleTZ(e.starts_at),
    time: timeInCircleTZ(e.starts_at),
    endTime: e.ends_at ? timeInCircleTZ(e.ends_at) : null,
    location: e.location,
    assignedName: assigned?.full_name?.split(" ")[0] ?? null,
    completed: !!e.completed_at
  };
}

const SELECT =
  "id, title, type, starts_at, ends_at, location, completed_at, assigned:assigned_to(full_name)";

export async function getEventsBetween(
  circleId: string,
  fromISO: string,
  toISO: string
): Promise<EventItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(SELECT)
    .eq("circle_id", circleId)
    .gte("starts_at", fromISO)
    .lt("starts_at", toISO)
    .order("starts_at");
  return (data ?? []).map(mapEvent);
}

export async function getUpcomingEvents(
  circleId: string,
  fromISO: string,
  limit = 60
): Promise<EventItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(SELECT)
    .eq("circle_id", circleId)
    .gte("starts_at", fromISO)
    .order("starts_at")
    .limit(limit);
  return (data ?? []).map(mapEvent);
}

export async function getNextAppointment(circleId: string, fromISO: string): Promise<EventItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(SELECT)
    .eq("circle_id", circleId)
    .in("type", ["medical", "visit"])
    .is("completed_at", null)
    .gte("starts_at", fromISO)
    .order("starts_at")
    .order("id")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapEvent(data) : null;
}
