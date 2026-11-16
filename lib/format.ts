/** Date/time display helpers. Storage is UTC; display is in the college's zone. */

export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "Tue 18 Nov, 08:15" in the given zone. */
export function formatRideTime(iso: string, timeZone: string, locale = "en-GB"): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
  return `${date.replace(/,/g, "")}, ${formatClock(iso, timeZone, locale)}`;
}

/** "08:15" in the given zone (24-hour). */
export function formatClock(iso: string, timeZone: string, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** "Tue 18 Nov, 07:30–08:30". */
export function formatWindow(startIso: string, endIso: string, timeZone: string): string {
  return `${formatRideTime(startIso, timeZone)}–${formatClock(endIso, timeZone)}`;
}

/** YYYY-MM-DD for a date in the given zone (for <input type="date">). */
export function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** YYYY-MM-DD `days` after an ISO date string (calendar arithmetic, no zone). */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** [1,2,3,4,5] → "Mon–Fri"; [0,6] → "Sun, Sat". */
export function formatDays(days: number[] | null | undefined): string {
  if (!days?.length) return "";
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return "Every day";
  if (sorted.join() === "1,2,3,4,5") return "Mon–Fri";
  if (sorted.join() === "0,1,2,3,4") return "Sun–Thu";
  return sorted.map((d) => WEEKDAYS_SHORT[d]).join(", ");
}
