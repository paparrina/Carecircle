// Zona horaria del círculo. En MVP fija (España); configurable en Ajustes más adelante.
export const CIRCLE_TZ = "Europe/Madrid";

/** Fecha YYYY-MM-DD "de hoy" en la zona del círculo (evita saltos de día por UTC). */
export function todayInCircleTZ(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CIRCLE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

/** Día de la semana 1=lunes … 7=domingo en la zona del círculo. */
export function weekdayInCircleTZ(dateISO?: string): number {
  const d = dateISO ? new Date(`${dateISO}T12:00:00`) : new Date();
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: CIRCLE_TZ,
    weekday: "short"
  }).format(d);
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[wd]!;
}

export function lastNDates(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    out.push(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: CIRCLE_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(d)
    );
  }
  return out.reverse();
}

/** Offset (min) de Europe/Madrid respecto a UTC en un instante dado. */
function madridOffsetMin(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: CIRCLE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(at).map((p) => [p.type, p.value])
  );
  const asUTC = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour === 24 ? 0 : +parts.hour,
    +parts.minute
  );
  return (asUTC - at.getTime()) / 60000;
}

/** Convierte fecha+hora local de Madrid a ISO UTC (timestamptz). */
export function madridToUTC(dateISO: string, timeHHMM: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [h, min] = timeHHMM.split(":").map(Number);
  let ts = Date.UTC(y, m - 1, d, h, min);
  // dos iteraciones cubren los cambios de horario CET/CEST
  ts -= madridOffsetMin(new Date(ts)) * 60000;
  ts = Date.UTC(y, m - 1, d, h, min) - madridOffsetMin(new Date(ts)) * 60000;
  return new Date(ts).toISOString();
}

/** YYYY-MM-DD del instante dado, en la zona del círculo. */
export function dateInCircleTZ(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CIRCLE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(iso));
}

/** HH:MM del instante dado, en la zona del círculo. */
export function timeInCircleTZ(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: CIRCLE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(iso));
}

/** Próxima ocurrencia de una fecha (anual si recurring) y días restantes. */
export function nextOccurrence(
  dateISO: string,
  recurring: boolean,
  todayISO: string = todayInCircleTZ()
): { date: string; daysUntil: number } {
  let next = dateISO;
  if (recurring) {
    const [, m, d] = dateISO.split("-");
    const year = Number(todayISO.slice(0, 4));
    next = `${year}-${m}-${d}`;
    if (next < todayISO) next = `${year + 1}-${m}-${d}`;
  }
  const days = Math.round(
    (Date.parse(`${next}T12:00:00Z`) - Date.parse(`${todayISO}T12:00:00Z`)) /
      86400000
  );
  return { date: next, daysUntil: days };
}
