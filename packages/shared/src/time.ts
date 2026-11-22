const ATHENS = "Europe/Athens";

export function athensParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: ATHENS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => formatted.find((item) => item.type === type)?.value ?? "0";
  const hour = Number(part("hour"));
  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
    hour: hour === 24 ? 0 : hour,
    minute: Number(part("minute")),
    second: Number(part("second")),
  };
}

/** UTC instant for a civil date and clock time in Europe/Athens, including DST. */
export function athensInstant(year: number, month: number, day: number, hour: number, minute: number, second = 0): Date {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = new Date(wanted);
  for (let attempt = 0; attempt < 3; attempt++) {
    const seen = athensParts(guess);
    const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
    const next = new Date(guess.getTime() - (seenUtc - wanted));
    if (next.getTime() === guess.getTime()) return next;
    guess = next;
  }
  return guess;
}

/**
 * Keep the source shift's Europe/Athens clock time, and place it on `date`
 * (`YYYY-MM-DD` in Athens). Winter 08:00 stays 08:00 in summer, so the UTC
 * hour changes with DST.
 */
export function copyAthensClock(source: Date, date: string): Date {
  const clock = athensParts(source);
  const [year, month, day] = date.split("-").map(Number);
  return athensInstant(year, month, day, clock.hour, clock.minute, clock.second);
}

export function athensDateKey(date: Date): string {
  const parts = athensParts(date);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

/** Inclusive Athens civil day, from 00:00:00 through 23:59:59. */
export function athensDayBounds(from = new Date()): { start: Date; end: Date } {
  const parts = athensParts(from);
  return {
    start: athensInstant(parts.year, parts.month, parts.day, 0, 0, 0),
    end: athensInstant(parts.year, parts.month, parts.day, 23, 59, 59),
  };
}

/** Calendar date in Athens, plus `days` civil days (not 24-hour chunks). */
export function athensDatePlus(days: number, from = new Date()): string {
  const today = athensParts(from);
  const civil = new Date(Date.UTC(today.year, today.month - 1, today.day + days));
  const month = String(civil.getUTCMonth() + 1).padStart(2, "0");
  const day = String(civil.getUTCDate()).padStart(2, "0");
  return `${civil.getUTCFullYear()}-${month}-${day}`;
}
