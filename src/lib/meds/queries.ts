import { createClient } from "@/lib/supabase/server";
import { madridToUTC, todayInCircleTZ, weekdayInCircleTZ } from "@/lib/dates";

export type TodayDose = {
  scheduleId: string;
  medicationId: string;
  time: string; // HH:MM
  name: string;
  dosage: string;
  instructions: string | null;
  assignedName: string | null;
  log: {
    id: string;
    status: "taken" | "skipped" | "missed";
    byName: string;
    at: string;
  } | null;
};

/** Tomas de hoy del círculo, ordenadas por hora, con su registro si existe. */
export async function getTodayDoses(circleId: string, requestedDate?: string): Promise<{
  date: string;
  doses: TodayDose[];
}> {
  const supabase = await createClient();
  const date = requestedDate ?? todayInCircleTZ();
  const weekday = weekdayInCircleTZ(date);

  const [
    { data: meds, error: medsErr },
    { data: logs, error: logsErr }
  ] = await Promise.all([
    supabase
      .from("medications")
      .select(
        "id, name, dosage, instructions, active, archived_at, created_at, assigned:assigned_to(full_name), medication_schedules(id, time_of_day, days_of_week, effective_at, retired_at)"
      )
      .eq("circle_id", circleId)
      .or("active.eq.true,archived_at.not.is.null"),
    supabase
      .from("medication_logs")
      .select("id, schedule_id, status, logged_at, by:logged_by(full_name)")
      .eq("circle_id", circleId)
      .eq("due_date", date)
  ]);

  // No tratar un fallo de lectura como "sin tomas registradas": eso haría parecer
  // pendiente una toma que en realidad ya se dio, o vaciaría la lista del día.
  if (medsErr) throw new Error(`getTodayDoses: fallo al leer medications (${medsErr.message})`);
  if (logsErr) throw new Error(`getTodayDoses: fallo al leer medication_logs (${logsErr.message})`);

  const logBySchedule = new Map(
    (logs ?? []).map((l) => {
      const by = Array.isArray(l.by) ? l.by[0] : l.by;
      return [
        l.schedule_id,
        {
          id: l.id as string,
          status: l.status as "taken" | "skipped" | "missed",
          byName: by?.full_name?.split(" ")[0] ?? "",
          at: l.logged_at as string
        }
      ];
    })
  );

  const doses: TodayDose[] = [];
  for (const m of meds ?? []) {
    const assigned = Array.isArray(m.assigned) ? m.assigned[0] : m.assigned;
    for (const s of m.medication_schedules ?? []) {
      if (!(s.days_of_week as number[]).includes(weekday)) continue;
      const due = Date.parse(madridToUTC(date, s.time_of_day.slice(0, 5)));
      const starts = Date.parse(s.effective_at ?? m.created_at);
      const ends = Math.min(
        s.retired_at ? Date.parse(s.retired_at) : Infinity,
        m.archived_at ? Date.parse(m.archived_at) : Infinity
      );
      const log = logBySchedule.get(s.id) ?? null;
      if (!log && (due < starts || due >= ends)) continue;
      doses.push({
        scheduleId: s.id,
        medicationId: m.id,
        time: (s.time_of_day as string).slice(0, 5),
        name: m.name,
        dosage: m.dosage,
        instructions: m.instructions,
        assignedName: assigned?.full_name?.split(" ")[0] ?? null,
        log
      });
    }
  }
  doses.sort((a, b) => a.time.localeCompare(b.time));
  return { date, doses };
}
