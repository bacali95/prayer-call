import type { AdhanKey, PrayerTimes } from "@/lib/prayers";

export type { PrayerTimes };

export interface Mosque {
  uuid?: string;
  id?: string;
  name: string;
  address?: string | null;
}

export interface CastDevice {
  uuid: string;
  name: string;
  model_name?: string | null;
  cast_type?: string | null;
  host?: string | null;
}

export type AdhanFiles = Partial<Record<AdhanKey, string | null>>;
export type AdhanVolumes = Partial<Record<AdhanKey, number | null>>;

export interface FileInfo {
  name: string;
  size: number;
}

export interface CronJob {
  prayer: string;
  schedule: string;
  planned_time?: string | null;
  command?: string;
  last_run?: string | null;
  executed_today?: boolean;
}

export interface PrayerScheduleDate {
  gregorian: string;
  hijri: string;
}

export interface Config {
  mosque?: Mosque | null;
  chromecast?: CastDevice | null;
  adhan_files?: AdhanFiles;
  adhan_volumes?: AdhanVolumes;
  prayer_times?: PrayerTimes;
  prayer_schedule_date?: PrayerScheduleDate;
  unsplash_configured?: boolean;
  /** Set when the config was saved but (re)scheduling the cron jobs failed. */
  scheduling_error?: string;
}

/** Body accepted by POST /api/config. adhan_* are partial merges; "" clears the Unsplash key. */
export interface ConfigUpdate {
  mosque?: Mosque;
  chromecast?: CastDevice;
  adhan_files?: AdhanFiles;
  adhan_volumes?: AdhanVolumes;
  unsplash_access_key?: string;
}

export interface YearDay {
  dayOfYear: number;
  date: string;
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  isDST: boolean;
  gregorian: string;
  hijri: string;
}

export interface YearData {
  year: number;
  data: YearDay[];
  dstTransitions: Array<{ dayOfYear: number; date: string }>;
}
