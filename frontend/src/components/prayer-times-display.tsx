import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Alert } from "./ui/alert";
import { Config, CronJob, PrayerTimes } from "../types";
import { PrayerTimesGrid } from "./prayer-times/prayer-times-grid";
import { CronJobList } from "./prayer-times/cron-job-list";
import { LogsModal } from "./prayer-times/logs-modal";

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
  apiBase: string;
};

const PrayerTimesDisplay: React.FC<PrayerTimesDisplayProps> = ({
  config,
  updateConfig,
  apiBase,
}) => {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingLogs, setViewingLogs] = useState<{
    prayer: string;
    logs: string;
  } | null>(null);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  const loadCronJobs = useCallback(async (): Promise<void> => {
    try {
      const response = await axios.get<{ jobs: CronJob[] }>(
        `${apiBase}/cron/jobs`
      );
      setCronJobs(response.data.jobs || []);
    } catch (err) {
      console.error("Failed to load cron jobs:", err);
    }
  }, [apiBase]);

  const removeCronJob = async (prayer: string): Promise<void> => {
    try {
      await axios.delete(`${apiBase}/cron/jobs/${prayer}`);
      await loadCronJobs();
      setError(null);
    } catch (err) {
      setError(`Failed to remove cron job for ${prayer}`);
      console.error(err);
    }
  };

  const viewLogs = async (prayer: string): Promise<void> => {
    setLoadingLogs(true);
    try {
      const response = await axios.get<{ logs: string; prayer: string }>(
        `${apiBase}/cron/jobs/${prayer}/logs`
      );
      setViewingLogs({ prayer, logs: response.data.logs });
    } catch (err) {
      setError(`Failed to load logs for ${prayer}`);
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadCronJobs();
  }, [loadCronJobs]);

  const refreshPrayerTimes = async (): Promise<void> => {
    if (!config?.mosque) {
      setError("Please select a mosque first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const mosqueId = config.mosque.uuid || config.mosque.id;
      const response = await axios.get<PrayerTimes>(
        `${apiBase}/mosques/${mosqueId}/prayer-times`
      );

      await updateConfig({ prayer_times: response.data });
      await loadCronJobs();
      setError(null);
    } catch (err) {
      setError("Failed to refresh prayer times");
      console.error(err);
    } finally {
      setLoading(false);
    }
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
        <Button onClick={refreshPrayerTimes} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Prayer Times"}
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
            config={config}
            cronJobs={cronJobs}
            prayerNames={PRAYER_NAMES}
          />
        ) : (
          <Alert type="info">
            No prayer times available. Please refresh to load prayer times.
          </Alert>
        )}

        <CronJobList
          cronJobs={cronJobs}
          prayerNames={PRAYER_NAMES}
          onViewLogs={viewLogs}
          onRemove={removeCronJob}
          loadingLogs={loadingLogs}
        />
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
