export const PRAYER_KEYS = ["fajr", "shuruq", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];

export const ADHAN_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type AdhanKey = Exclude<PrayerKey, "shuruq">;

export type PrayerTimes = Partial<Record<PrayerKey, string>>;

export interface PrayerMeta {
  key: PrayerKey;
  en: string;
  ar: string;
  /** Whether an adhan can be assigned and scheduled for this entry. Shuruq (sunrise) is display only. */
  adhan: boolean;
}

export const PRAYERS: Record<PrayerKey, PrayerMeta> = {
  fajr: { key: "fajr", en: "Fajr", ar: "الفجر", adhan: true },
  shuruq: { key: "shuruq", en: "Shuruq", ar: "الشروق", adhan: false },
  dhuhr: { key: "dhuhr", en: "Dhuhr", ar: "الظهر", adhan: true },
  asr: { key: "asr", en: "Asr", ar: "العصر", adhan: true },
  maghrib: { key: "maghrib", en: "Maghrib", ar: "المغرب", adhan: true },
  isha: { key: "isha", en: "Isha", ar: "العشاء", adhan: true },
};

export function isAdhanKey(key: string): key is AdhanKey {
  return (ADHAN_KEYS as readonly string[]).includes(key);
}

export function isPrayerKey(key: string): key is PrayerKey {
  return (PRAYER_KEYS as readonly string[]).includes(key);
}
