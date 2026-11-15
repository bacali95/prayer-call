import { PRAYER_KEYS, PRAYERS, type PrayerKey, type PrayerTimes } from "@/lib/prayers";

export type PrayerStatus = "passed" | "next" | "upcoming";

export interface TimelineEntry {
  key: PrayerKey;
  time: string;
  date: Date;
  status: PrayerStatus;
}

export interface NextPrayer {
  key: PrayerKey;
  time: string;
  date: Date;
  /** True when every prayer of today has passed and this is tomorrow's first prayer. */
  tomorrow: boolean;
}

export function parseHM(value: string | undefined | null): { h: number; m: number } | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

/** The given HH:MM on the same calendar day as `base`. */
export function atTime(base: Date, value: string | undefined | null): Date | null {
  const hm = parseHM(value);
  if (!hm) return null;
  const d = new Date(base);
  d.setHours(hm.h, hm.m, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

interface Slot {
  key: PrayerKey;
  time: string;
  date: Date;
}

function slots(times: PrayerTimes | undefined, now: Date): Slot[] {
  const out: Slot[] = [];
  for (const key of PRAYER_KEYS) {
    const time = times?.[key];
    const date = atTime(now, time);
    if (time && date) out.push({ key, time, date });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Today's timeline. The "next" entry is the first adhan prayer still ahead of `now`;
 * shuruq is never "next" (it is display only) and is just passed/upcoming.
 */
export function buildTimeline(times: PrayerTimes | undefined, now: Date): TimelineEntry[] {
  const list = slots(times, now);
  const next = list.find((s) => PRAYERS[s.key].adhan && s.date.getTime() > now.getTime());
  return list.map((s) => ({
    ...s,
    status:
      next && s.key === next.key
        ? "next"
        : s.date.getTime() <= now.getTime()
          ? "passed"
          : "upcoming",
  }));
}

/** Next adhan prayer, rolling over to tomorrow's first prayer after Isha. */
export function getNextPrayer(times: PrayerTimes | undefined, now: Date): NextPrayer | null {
  const list = slots(times, now).filter((s) => PRAYERS[s.key].adhan);
  if (list.length === 0) return null;
  const upcoming = list.find((s) => s.date.getTime() > now.getTime());
  if (upcoming) return { ...upcoming, tomorrow: false };
  const first = list[0];
  return { ...first, date: addDays(first.date, 1), tomorrow: true };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** HH:MM:SS countdown. Negative values clamp to zero. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Compact duration such as "2h 05m" or "9m". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
}

export function formatGregorian(date: Date, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatHijri(date: Date, locale: "en" | "ar" = "en"): string {
  const tag = locale === "ar" ? "ar-SA-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura";
  try {
    return new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric" }).format(date);
  } catch {
    return "";
  }
}
