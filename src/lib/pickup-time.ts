/** Store pickup slots use the local time in Nice, regardless of device or server timezone. */
export const PICKUP_TIME_ZONE = "Europe/Paris";

const parisPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: PICKUP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parisParts(date: Date) {
  const parts = Object.fromEntries(
    parisPartsFormatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

/** Return a datetime-local input value in Nice's timezone. */
export function formatParisDateTimeInput(value: Date): string {
  const p = parisParts(value);
  const two = (v: number) => String(v).padStart(2, "0");
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}

/**
 * Interpret an HTML datetime-local value as a wall time in Nice.
 * Reject invalid / nonexistent DST-transition wall times instead of guessing.
 */
export function parseParisDateTimeInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const intended = Date.UTC(y, mo - 1, d, h, mi);
  let instant = intended;
  for (let i = 0; i < 3; i++) {
    const p = parisParts(new Date(instant));
    const observed = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const adjustment = intended - observed;
    if (!adjustment) break;
    instant += adjustment;
  }
  const result = new Date(instant);
  return formatParisDateTimeInput(result) === value ? result : null;
}

/**
 * The CMS currently stores one opening interval for every day (e.g. 11h–19h).
 * Reject per-weekday schedules or unrecognized values rather than invent availability.
 */
export function parseDailyPickupHours(value?: string | null): {
  opensMinutes: number;
  closesMinutes: number;
} | null {
  const source = String(value || "").trim() || "11h–19h";
  if (/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday|closed)\b|ferm[ée]/i.test(source)) {
    return null;
  }
  const ranges = [...source.matchAll(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:-|–|—|à)\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?/gi)];
  if (ranges.length !== 1) return null;
  const [, startHour, startMinute = "00", endHour, endMinute = "00"] = ranges[0];
  const sh = Number(startHour), sm = Number(startMinute);
  const eh = Number(endHour), em = Number(endMinute);
  const opensMinutes = sh * 60 + sm, closesMinutes = eh * 60 + em;
  if (sh > 23 || eh > 23 || sm > 59 || em > 59 || opensMinutes >= closesMinutes) return null;
  return { opensMinutes, closesMinutes };
}

export function isWithinPickupHours(date: Date | string, hours?: string | null): boolean {
  const parsed = parseDailyPickupHours(hours);
  const value = new Date(date);
  if (!parsed || !Number.isFinite(value.getTime())) return false;
  const p = parisParts(value);
  const minutes = p.hour * 60 + p.minute;
  return minutes >= parsed.opensMinutes && minutes < parsed.closesMinutes;
}

export function formatParisPickupDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: PICKUP_TIME_ZONE,
  }).format(new Date(value));
}
