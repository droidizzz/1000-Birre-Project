// Date helpers.
//
// WhatsApp exports carry the sender's local wall-clock time with no time zone.
// We store every timestamp as if that wall-clock time were UTC ("naive UTC"),
// so all arithmetic is free of DST jumps and of the viewer's own time zone.

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

/** Day number (days since 1970-01-01) of a naive timestamp, with the day starting at `dayStartHour`. */
export function dayOf(ts, dayStartHour = 0) {
  return Math.floor((ts - dayStartHour * HOUR_MS) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(day) {
  return (new Date(day * DAY_MS).getUTCDay() + 6) % 7;
}

/** Monday of the week containing `day`. */
export function weekStartOf(day) {
  return day - weekdayOf(day);
}

/** Hour of day (0–23) of a naive timestamp. */
export function hourOf(ts) {
  return new Date(ts).getUTCHours();
}

export function dayToISO(day) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function isoToDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function tsToISO(ts) {
  return new Date(ts).toISOString().slice(0, 19);
}
