import type {
  Config,
  Mosque,
  PrayerTimes,
  ChromecastDevice,
  FileInfo,
  CronJob,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

// API Functions
export const api = {
  // Config
  getConfig: async (): Promise<Config> => {
    const response = await fetch(`${API_BASE}/config`);
    if (!response.ok) throw new Error("Failed to load configuration");
    return response.json();
  },

  updateConfig: async (updates: Partial<Config>): Promise<Config> => {
    const response = await fetch(`${API_BASE}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error("Failed to update configuration");
    return response.json();
  },

  // Mosques
  searchMosques: async (query: string): Promise<{ mosques: Mosque[] }> => {
    const response = await fetch(
      `${API_BASE}/mosques/search?${new URLSearchParams({ q: query })}`
    );
    if (!response.ok) throw new Error("Failed to search mosques");
    return response.json();
  },

  getPrayerTimes: async (mosqueId: string): Promise<PrayerTimes> => {
    const response = await fetch(
      `${API_BASE}/mosques/${mosqueId}/prayer-times`
    );
    if (!response.ok) throw new Error("Failed to get prayer times");
    return response.json();
  },

  // Chromecast
  scanChromecasts: async (
    timeout: number = 60
  ): Promise<{
    devices: ChromecastDevice[];
  }> => {
    const response = await fetch(
      `${API_BASE}/chromecasts/scan?${new URLSearchParams({
        timeout: timeout.toString(),
      })}`
    );
    if (!response.ok) throw new Error("Failed to scan for Chromecast devices");
    return response.json();
  },

  // Files
  getFiles: async (): Promise<{ files: FileInfo[] }> => {
    const response = await fetch(`${API_BASE}/files`);
    if (!response.ok) throw new Error("Failed to load files");
    return response.json();
  },

  uploadFile: async (file: File): Promise<void> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE}/files`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("Failed to upload file");
  },

  deleteFile: async (filename: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/files/${filename}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete file");
  },

  // Test play
  testPlay: async (data: {
    chromecast_name: string;
    filename: string;
    volume?: number | null;
  }): Promise<void> => {
    const response = await fetch(`${API_BASE}/test/play`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to play adhan");
  },

  // Cron jobs
  getCronJobs: async (): Promise<{ jobs: CronJob[] }> => {
    const response = await fetch(`${API_BASE}/cron/jobs`);
    if (!response.ok) throw new Error("Failed to load cron jobs");
    return response.json();
  },

  deleteCronJob: async (prayer: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/cron/jobs/${prayer}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to remove cron job");
  },

  getCronJobLogs: async (
    prayer: string
  ): Promise<{
    logs: string;
    prayer: string;
  }> => {
    const response = await fetch(`${API_BASE}/cron/jobs/${prayer}/logs`);
    if (!response.ok) throw new Error("Failed to load logs");
    return response.json();
  },
};
