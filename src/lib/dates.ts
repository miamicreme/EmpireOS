/**
 * Date helpers. The DB stores timestamptz; these helpers work in ISO/UTC and
 * return strings safe for `date` columns (YYYY-MM-DD).
 */

export function todayISODate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function nowISO(now: Date = new Date()): string {
  return now.toISOString();
}

/** Returns the Monday (UTC) of the week containing `now` as YYYY-MM-DD. */
export function weekStartISODate(now: Date = new Date()): string {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

/** ISO date N days ago (UTC), as YYYY-MM-DD. */
export function isoDateDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
