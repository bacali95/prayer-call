import React from "react";
import { PrayerTimeCard } from "./prayer-time-card";
import { Config, CronJob } from "../../types";
import { sortByPrayerOrder } from "../../lib/utils";

type PrayerTimesGridProps = {
  prayerTimes: Record<string, string | { [key: string | number]: string }>;
  config: Config;
  cronJobs: CronJob[];
  prayerNames: Record<string, string>;
};

export const PrayerTimesGrid: React.FC<PrayerTimesGridProps> = ({
  prayerTimes,
  config,
  cronJobs,
  prayerNames,
}) => {
  // Sort prayer times: reschedule first, then by prayer order
  const sortedPrayerTimes = React.useMemo(() => {
    return sortByPrayerOrder(Object.entries(prayerTimes));
  }, [prayerTimes]);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
      {sortedPrayerTimes.map(([prayer, time]) => {
        if (!time) return null;

        // Handle case where time is an object with day numbers as keys
        let displayTime: string;
        if (typeof time === "object" && time !== null && !Array.isArray(time)) {
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
          <PrayerTimeCard
            key={prayer}
            prayerName={prayerNames[prayer] || prayer}
            time={displayTime}
            hasFile={!!hasFile}
            isScheduled={isScheduled}
          />
        );
      })}
    </div>
  );
};
