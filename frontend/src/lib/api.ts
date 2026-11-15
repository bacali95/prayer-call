import type {
  CastDevice,
  Config,
  ConfigUpdate,
  CronJob,
  FileInfo,
  Mosque,
  Place,
  Weather,
  WeatherProvider,
  YearData,
} from "@/lib/types";
import type { PrayerTimes } from "@/lib/prayers";

const API_BASE: string = import.meta.env.VITE_API_URL || "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error: unknown }).error;
    if (typeof e === "string" && e) return e;
  }
  return fallback;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection.", 0);
  }
  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
  }
  if (!response.ok) {
    throw new ApiError(extractMessage(body, `Request failed (${response.status})`), response.status);
  }
  return body as T;
}

function json(method: string, data: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

const enc = encodeURIComponent;

export const api = {
  getConfig: () => request<Config>("/config"),
  updateConfig: (updates: ConfigUpdate) => request<Config>("/config", json("POST", updates)),
  getVersion: () => request<{ version: string }>("/version"),

  searchMosques: (q: string) => request<{ mosques: Mosque[] }>(`/mosques/search?${new URLSearchParams({ q })}`),
  getPrayerTimes: (mosqueId: string) => request<PrayerTimes>(`/mosques/${enc(mosqueId)}/prayer-times`),
  getYear: (mosqueId: string) => request<YearData>(`/mosques/${enc(mosqueId)}/prayer-times/year`),

  scanSpeakers: (timeout = 10) =>
    request<{ devices: CastDevice[] }>(`/chromecasts/scan?${new URLSearchParams({ timeout: String(timeout) })}`),

  getFiles: () => request<{ files: FileInfo[] }>("/files"),
  deleteFile: (name: string) =>
    request<{ deleted: string; unassigned?: string[] }>(`/files/${enc(name)}`, { method: "DELETE" }),
  fileUrl: (name: string) => `${API_BASE}/files/${enc(name)}`,

  testPlay: (data: { chromecast_name: string; filename: string; volume?: number | null }) =>
    request<unknown>("/test/play", json("POST", data)),

  getCronJobs: () => request<{ jobs: CronJob[] }>("/cron/jobs"),
  deleteCronJob: (prayer: string) => request<unknown>(`/cron/jobs/${enc(prayer)}`, { method: "DELETE" }),
  getCronLogs: (prayer: string) => request<{ logs: string; prayer: string }>(`/cron/jobs/${enc(prayer)}/logs`),

  getSlides: async () => (await request<{ urls: string[] }>("/screensaver/slides")).urls ?? [],

  getWeather: async () => (await request<{ weather: Weather | null }>("/weather/current")).weather,
  getWeatherProviders: async () => (await request<{ providers: WeatherProvider[] }>("/weather/providers")).providers,
  geocode: async (q: string) =>
    (await request<{ places: Place[] }>(`/weather/geocode?${new URLSearchParams({ q })}`)).places,
};

/** Upload with progress reporting (fetch cannot report upload progress). */
export function uploadFile(file: File, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/files`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new ApiError("Cannot reach the server. Check your connection.", 0));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = undefined;
      }
      reject(new ApiError(extractMessage(body, `Upload failed (${xhr.status})`), xhr.status));
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
