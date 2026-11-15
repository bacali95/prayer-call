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
  weather?: WeatherSettings;
  /** Providers whose API key is stored on the server (keys are never sent back). */
  weather_keys_configured?: WeatherProviderId[];
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
  /** Partial merge. */
  weather?: Partial<WeatherSettings>;
  /** Partial merge; "" clears that provider's key. */
  weather_api_keys?: Partial<Record<WeatherProviderId, string>>;
}

export type WeatherProviderId = "open-meteo" | "openweathermap" | "weatherapi";
export type WeatherUnits = "metric" | "imperial";
export type WeatherCondition =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunderstorm";

export interface WeatherLocation {
  name?: string | null;
  latitude: number;
  longitude: number;
}

export interface WeatherSettings {
  enabled: boolean;
  provider: WeatherProviderId;
  units: WeatherUnits;
  location: WeatherLocation | null;
}

export interface WeatherProvider {
  id: WeatherProviderId;
  name: string;
  needs_key: boolean;
  url: string;
}

export interface Weather {
  temperature: number;
  units: WeatherUnits;
  condition: WeatherCondition;
  description: string;
  is_day: boolean;
  provider: WeatherProviderId;
  location?: string | null;
  updated_at: string;
}

export interface Place {
  name: string;
  region: string;
  latitude: number;
  longitude: number;
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
