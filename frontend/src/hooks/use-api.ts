import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@ui-sdk/react/toast";
import { api, uploadFile } from "@/lib/api";
import { PRAYERS, isPrayerKey } from "@/lib/prayers";
import type { CastDevice, ConfigUpdate, Mosque } from "@/lib/types";

export const keys = {
  config: ["config"] as const,
  cron: ["cron"] as const,
  files: ["files"] as const,
  version: ["version"] as const,
  weather: ["weather"] as const,
};

export function useConfig(opts: { refetchInterval?: number } = {}) {
  return useQuery({ queryKey: keys.config, queryFn: api.getConfig, ...opts });
}

export function useVersion() {
  return useQuery({
    queryKey: keys.version,
    queryFn: api.getVersion,
    staleTime: Infinity,
    retry: false,
  });
}

export function useUpdateConfig(successMessage?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: ConfigUpdate) => api.updateConfig(updates),
    meta: { success: successMessage },
    onSuccess: (data) => {
      qc.setQueryData(keys.config, data);
      void qc.invalidateQueries({ queryKey: keys.weather });
      void qc.invalidateQueries({ queryKey: keys.cron });
    },
  });
}

export function useCronJobs() {
  return useQuery({
    queryKey: keys.cron,
    queryFn: async () => (await api.getCronJobs()).jobs,
  });
}

export function useDeleteCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prayer: string) => api.deleteCronJob(prayer),
    meta: { success: "Scheduled job removed" },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.cron }),
  });
}

export function useCronLogs(prayer: string | null) {
  return useQuery({
    queryKey: ["cron-logs", prayer],
    queryFn: () => api.getCronLogs(prayer as string),
    enabled: prayer !== null,
    retry: false,
  });
}

export function useFiles() {
  return useQuery({
    queryKey: keys.files,
    queryFn: async () => (await api.getFiles()).files,
  });
}

export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (f: number) => void }) =>
      uploadFile(file, onProgress),
    onSuccess: (_d, { file }) => {
      toast.success(`Uploaded ${file.name}`);
      return qc.invalidateQueries({ queryKey: keys.files });
    },
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.deleteFile(name),
    onSuccess: (res, name) => {
      const names = (res.unassigned ?? []).map((k) => (isPrayerKey(k) ? PRAYERS[k].en : k));
      toast.success(
        names.length ? `Deleted ${name}. ${names.join(", ")} now ${names.length === 1 ? "has" : "have"} no adhan.` : `Deleted ${name}`,
      );
      void qc.invalidateQueries({ queryKey: keys.files });
      void qc.invalidateQueries({ queryKey: keys.config });
      void qc.invalidateQueries({ queryKey: keys.cron });
    },
  });
}

export function useTestPlay() {
  return useMutation({
    mutationFn: api.testPlay,
    meta: { success: "Playing on your speaker" },
  });
}

export function useSearchMosques(query: string) {
  return useQuery({
    queryKey: ["mosques", query],
    queryFn: async () => (await api.searchMosques(query)).mosques,
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Persists the mosque and downloads its prayer times (which also reschedules the cron jobs). */
export function useSelectMosque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mosque: Mosque) => {
      await api.updateConfig({ mosque });
      const id = mosque.uuid ?? mosque.id;
      if (id) await api.getPrayerTimes(id);
    },
    meta: { success: "Mosque saved and prayer times loaded" },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.config });
      void qc.invalidateQueries({ queryKey: keys.cron });
    },
  });
}

export function useRefreshTimes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mosqueId: string) => api.getPrayerTimes(mosqueId),
    meta: { success: "Prayer times refreshed" },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.config });
      void qc.invalidateQueries({ queryKey: keys.cron });
    },
  });
}

export function useScanSpeakers() {
  return useMutation({
    mutationFn: async (): Promise<CastDevice[]> => (await api.scanSpeakers(10)).devices,
  });
}

export function useYear(mosqueId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["year", mosqueId],
    queryFn: () => api.getYear(mosqueId as string),
    enabled: enabled && !!mosqueId,
    staleTime: 60 * 60_000,
    retry: false,
  });
}

/** Current weather for the screensaver; null when weather is off or has no location. */
export function useWeather(enabled: boolean) {
  return useQuery({
    queryKey: keys.weather,
    queryFn: api.getWeather,
    enabled,
    refetchInterval: 10 * 60_000,
    retry: 1,
  });
}

export function useWeatherProviders() {
  return useQuery({ queryKey: ["weather-providers"], queryFn: api.getWeatherProviders, staleTime: Infinity });
}

export function useGeocode(query: string) {
  return useQuery({
    queryKey: ["geocode", query],
    queryFn: () => api.geocode(query),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useSlides() {
  return useQuery({
    queryKey: ["slides"],
    queryFn: api.getSlides,
    refetchInterval: 60 * 60_000,
    retry: 1,
  });
}
