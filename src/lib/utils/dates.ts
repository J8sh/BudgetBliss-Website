/**
 * Date range helpers for stats aggregation and filtering.
 * All functions return plain Date objects (no external date library dependency).
 */

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (6 - day));
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
}

export function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

/** Returns an ISO date string (YYYY-MM-DD) for a Date object */
export function toISODateString(date: Date): string {
  return date.toISOString().split("T")[0] ?? "";
}

/** Returns true if two dates are on the same calendar day */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** The viewer's calendar date (YYYY-MM-DD) in their own time zone, for sending to the API */
export function localDateString(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Now" for server-side date math, as noon UTC on the viewer's calendar date.
 *
 * Receipt dates are stored as UTC midnight of their calendar date, so the server's own UTC clock
 * runs a day ahead for viewers west of UTC in the evening (and a day behind east of UTC in the
 * morning): "today" would come out empty. The browser sends its local date instead; it's only
 * trusted within a day of the server clock, since no time zone is further apart than that.
 */
export function viewerNow(today: string | undefined, serverNow: Date = new Date()): Date {
  const match = today ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(today) : null;
  if (match) {
    const viewer = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
    const serverNoon = Date.UTC(serverNow.getUTCFullYear(), serverNow.getUTCMonth(), serverNow.getUTCDate(), 12);
    if (!Number.isNaN(viewer.getTime()) && Math.abs(viewer.getTime() - serverNoon) <= DAY_MS) return viewer;
  }
  return serverNow;
}
