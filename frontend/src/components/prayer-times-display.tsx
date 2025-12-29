import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Alert } from "./ui/alert";
import { Config } from "../types";
import { PrayerTimesGrid } from "./prayer-times/prayer-times-grid";
import { CronJobList } from "./prayer-times/cron-job-list";
import { LogsModal } from "./prayer-times/logs-modal";
import { PrayerTimesYearChart } from "./prayer-times/prayer-times-year-chart";
import { api } from "../lib/api";
import { sortByPrayerOrder } from "../lib/utils";

const PRAYER_NAMES: { [key: string]: string } = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
  reschedule: "Reschedule Prayers",
};

type PrayerTimesDisplayProps = {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => Promise<boolean>;
};

const PrayerTimesDisplay: React.FC<PrayerTimesDisplayProps> = ({
  config,
  updateConfig,
}) => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [viewingLogs, setViewingLogs] = useState<{
    prayer: string;
    logs: string;
  } | null>(null);

  // Check if debug mode is enabled via query parameter
  const isDebugMode = searchParams.get("debug") !== null;

  const { data: cronJobsData } = useQuery({
    queryKey: ["cronJobs"],
    queryFn: async () => {
      const data = await api.getCronJobs();
      return data.jobs || [];
    },
  });

  // Fetch year prayer times data for chart
  const { data: yearPrayerTimesData } = useQuery({
    queryKey: ["yearPrayerTimes", config?.mosque?.uuid || config?.mosque?.id],
    queryFn: async () => {
      if (!config?.mosque) {
        throw new Error("No mosque selected");
      }
      const mosqueId = config.mosque.uuid || config.mosque.id;
      if (!mosqueId) {
        throw new Error("Invalid mosque ID");
      }
      return api.getPrayerTimesYear(mosqueId);
    },
    enabled: !!config?.mosque && (!!config.mosque.uuid || !!config.mosque.id),
  });

  // Sort cron jobs: reschedule first, then by prayer order
  const sortedCronJobs = React.useMemo(() => {
    const cronJobs = cronJobsData || [];
    return sortByPrayerOrder(cronJobs);
  }, [cronJobsData]);

  const removeCronJobMutation = useMutation({
    mutationFn: (prayer: string) => api.deleteCronJob(prayer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cronJobs"] });
      setError(null);
    },
    onError: (err, prayer) => {
      setError(`Failed to remove cron job for ${prayer}`);
      console.error(err);
    },
  });

  const getLogsMutation = useMutation({
    mutationFn: (prayer: string) => api.getCronJobLogs(prayer),
    onSuccess: (data, prayer) => {
      setViewingLogs({ prayer, logs: data.logs });
    },
    onError: (err, prayer) => {
      setError(`Failed to load logs for ${prayer}`);
      console.error(err);
    },
  });

  const refreshPrayerTimesMutation = useMutation({
    mutationFn: async () => {
      if (!config?.mosque) {
        throw new Error("Please select a mosque first");
      }
      const mosqueId = config.mosque.uuid || config.mosque.id;
      if (!mosqueId) {
        throw new Error("Invalid mosque ID");
      }
      return api.getPrayerTimes(mosqueId);
    },
    onSuccess: async (prayerTimes) => {
      await updateConfig({ prayer_times: prayerTimes });
      queryClient.invalidateQueries({ queryKey: ["cronJobs"] });
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : "Failed to refresh prayer times"
      );
      console.error(err);
    },
  });

  const removeCronJob = async (prayer: string): Promise<void> => {
    removeCronJobMutation.mutate(prayer);
  };

  const viewLogs = async (prayer: string): Promise<void> => {
    getLogsMutation.mutate(prayer);
  };

  const refreshPrayerTimes = async (): Promise<void> => {
    refreshPrayerTimesMutation.mutate();
  };

  if (!config?.mosque) {
    return (
      <div>
        <Alert type="info">
          Please select a mosque first to view prayer times.
        </Alert>
      </div>
    );
  }

  const prayerTimes = config.prayer_times || {};

  return (
    <div>
      <div className="flex gap-2 w-full justify-between items-center mb-4">
        <h2 className="text-xl font-semibold mb-3 text-foreground">
          Prayer Times Schedule
        </h2>
        <Button
          onClick={refreshPrayerTimes}
          disabled={refreshPrayerTimesMutation.isPending}
        >
          {refreshPrayerTimesMutation.isPending
            ? "Refreshing..."
            : "Refresh Prayer Times"}
        </Button>
      </div>

      {error && (
        <Alert type="error" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        {config.prayer_schedule_date && (
          <Card className="p-4 text-center">
            <div className="mb-2">
              <strong>{config.prayer_schedule_date.gregorian}</strong>
            </div>
            <div className="text-sm text-muted-foreground">
              {config.prayer_schedule_date.hijri}
            </div>
          </Card>
        )}

        <div className="flex gap-3 w-full">
          {config.mosque && (
            <Card className="w-full p-4">
              <strong>Mosque:</strong> {config.mosque.name}
            </Card>
          )}

          {config.chromecast && (
            <Card className="w-full p-4">
              <strong>Chromecast:</strong> {config.chromecast.name}
            </Card>
          )}
        </div>

        {Object.keys(prayerTimes).length > 0 ? (
          <PrayerTimesGrid
            prayerTimes={prayerTimes}
            prayerNames={PRAYER_NAMES}
          />
        ) : (
          <Alert type="info">
            No prayer times available. Please refresh to load prayer times.
          </Alert>
        )}

        {yearPrayerTimesData && yearPrayerTimesData.data && (
          <PrayerTimesYearChart
            data={yearPrayerTimesData.data}
            year={yearPrayerTimesData.year}
            dstTransitions={yearPrayerTimesData.dstTransitions || []}
          />
        )}

        {isDebugMode && (
          <CronJobList
            cronJobs={sortedCronJobs}
            prayerNames={PRAYER_NAMES}
            config={config}
            onViewLogs={viewLogs}
            onRemove={removeCronJob}
            loadingLogs={getLogsMutation.isPending}
          />
        )}
      </div>

      {viewingLogs && (
        <LogsModal
          prayerName={PRAYER_NAMES[viewingLogs.prayer] || viewingLogs.prayer}
          logs={viewingLogs.logs}
          onClose={() => setViewingLogs(null)}
        />
      )}
    </div>
  );
};

export default PrayerTimesDisplay;
