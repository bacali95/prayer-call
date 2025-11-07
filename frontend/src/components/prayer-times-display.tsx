import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Alert } from "./ui/alert";
import { Config, CronJob, PrayerTimes } from "../types";

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

  const formatLastRun = (lastRun: string | null | undefined): string => {
    if (!lastRun) return "Never";
    try {
      const date = new Date(lastRun);
      return date.toLocaleString();
    } catch {
      return "Unknown";
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
      <div className="section">
        <Alert type="info">
          Please select a mosque first to view prayer times.
        </Alert>
      </div>
    );
  }

  const prayerTimes = config.prayer_times || {};

  return (
    <div className="section">
      <h2 className="section-title">Prayer Times Schedule</h2>

      {error && (
        <Alert type="error" style={{ marginBottom: "15px" }}>
          {error}
        </Alert>
      )}

      <div className="section-content">
        <div style={{ marginBottom: "20px" }}>
          <Button onClick={refreshPrayerTimes} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh Prayer Times"}
          </Button>
        </div>

        {config.mosque && (
          <Card style={{ padding: "15px" }}>
            <strong>Mosque:</strong> {config.mosque.name}
          </Card>
        )}

        {config.chromecast && (
          <Card style={{ padding: "15px" }}>
            <strong>Chromecast:</strong> {config.chromecast.name}
          </Card>
        )}

        {Object.keys(prayerTimes).length > 0 ? (
          <div className="prayer-times-grid">
            {Object.entries(prayerTimes).map(([prayer, time]) => {
              if (!time) return null;

              // Handle case where time is an object with day numbers as keys
              let displayTime: string;
              if (
                typeof time === "object" &&
                time !== null &&
                !Array.isArray(time)
              ) {
                // Get today's day number (1-31)
                const today = new Date().getDate();
                const timeObj = time as { [key: string | number]: string };
                // Try to get today's time, or fall back to first available
                displayTime =
                  timeObj[today] ||
                  timeObj[String(today)] ||
                  Object.values(timeObj)[0] ||
                  "N/A";
              } else {
                displayTime = String(time);
              }

              const hasFile = config.adhan_files?.[prayer];
              const isScheduled = cronJobs.some((job) => job.prayer === prayer);

              return (
                <Card key={prayer} className="prayer-time-card">
                  <div className="prayer-name">
                    {PRAYER_NAMES[prayer] || prayer}
                  </div>
                  <div className="prayer-time">{displayTime}</div>
                  <div className="text-xs text-muted-foreground mt-2.5">
                    {hasFile ? (
                      <span className="text-green-600 dark:text-green-400">
                        ✓ File assigned
                      </span>
                    ) : (
                      <span className="text-orange-600 dark:text-orange-400">
                        ⚠ No file
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isScheduled ? (
                      <span className="text-green-600 dark:text-green-400">
                        ✓ Scheduled
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">
                        ✗ Not scheduled
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Alert type="info">
            No prayer times available. Please refresh to load prayer times.
          </Alert>
        )}

        {cronJobs.length > 0 && (
          <div style={{ marginTop: "30px" }}>
            <h3 style={{ marginBottom: "15px" }}>Scheduled Jobs</h3>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {cronJobs.map((job, index) => (
                <Card
                  key={index}
                  style={{
                    padding: "15px",
                    fontSize: "14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <div>
                      <strong>{PRAYER_NAMES[job.prayer] || job.prayer}:</strong>{" "}
                      {job.schedule}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {job.last_run && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewLogs(job.prayer)}
                          disabled={loadingLogs}
                        >
                          {loadingLogs ? "Loading..." : "View Logs"}
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeCronJob(job.prayer)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      marginTop: "4px",
                    }}
                  >
                    Last run: {formatLastRun(job.last_run)}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {viewingLogs && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setViewingLogs(null)}
          >
            <Card
              style={{
                maxWidth: "80%",
                maxHeight: "80%",
                width: "1000px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "15px",
                }}
              >
                <h3 style={{ margin: 0 }}>
                  Logs for{" "}
                  {PRAYER_NAMES[viewingLogs.prayer] || viewingLogs.prayer}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingLogs(null)}
                >
                  Close
                </Button>
              </div>
              <div
                style={{
                  backgroundColor: "#1e1e1e",
                  color: "#d4d4d4",
                  padding: "15px",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  overflow: "auto",
                  maxHeight: "500px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {viewingLogs.logs || "No logs available"}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrayerTimesDisplay;
