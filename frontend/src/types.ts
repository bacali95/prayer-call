export type Mosque = {
  uuid?: string;
  id?: string;
  name: string;
  address?: string;
};

export type ChromecastDevice = {
  uuid: string;
  name: string;
  model_name?: string;
  cast_type?: string;
};

export type PrayerTimes = {
  [key: string]: string | { [day: string]: string } | { [day: number]: string };
};

export type AdhanFiles = {
  [key: string]: string | null;
};

export type AdhanVolumes = {
  [key: string]: number | null;
};

export type FileInfo = {
  name: string;
  size: number;
};

export type CronJob = {
  prayer: string;
  schedule: string;
  last_run?: string | null;
};

export type PrayerScheduleDate = {
  gregorian: string;
  hijri: string;
};

export type Config = {
  mosque?: Mosque;
  chromecast?: ChromecastDevice;
  adhan_files?: AdhanFiles;
  adhan_volumes?: AdhanVolumes;
  prayer_times?: PrayerTimes;
  prayer_schedule_date?: PrayerScheduleDate;
};
