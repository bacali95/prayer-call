import React, { useState, useEffect } from "react";
import { PrayerTimeCard } from "./prayer-time-card";
import { sortByPrayerOrder, isTimePassed, getCountdown } from "../../lib/utils";

type PrayerTimesGridProps = {
  prayerTimes: Record<string, string | { [key: string | number]: string }>;
  prayerNames: Record<string, string>;
};

export const PrayerTimesGrid: React.FC<PrayerTimesGridProps> = ({
  prayerTimes,
  prayerNames,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Sort prayer times: reschedule first, then by prayer order
  const sortedPrayerTimes = React.useMemo(() => {
    return sortByPrayerOrder(Object.entries(prayerTimes));
  }, [prayerTimes]);

  // Find the next upcoming prayer and determine which prayers have passed
  // Note: currentTime is used to trigger recalculation every second
  const { nextPrayer, passedPrayers } = React.useMemo(() => {
    const passed: Set<string> = new Set();
    let next: { prayer: string; time: string } | null = null;

    for (const [prayer, time] of sortedPrayerTimes) {
      if (!time || prayer === "reschedule") continue;

      // Handle case where time is an object with day numbers as keys
      let displayTime: string;
      if (typeof time === "object" && time !== null && !Array.isArray(time)) {
        const today = new Date().getDate();
        const timeObj = time as { [key: string | number]: string };
        displayTime =
          timeObj[today] ||
          timeObj[String(today)] ||
          Object.values(timeObj)[0] ||
          "";
      } else {
        displayTime = String(time);
      }

      if (!displayTime || displayTime === "N/A") continue;

      if (isTimePassed(displayTime)) {
        passed.add(prayer);
      } else if (!next) {
        next = { prayer, time: displayTime };
      }
    }

    return { nextPrayer: next, passedPrayers: passed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedPrayerTimes, currentTime]);

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

        const isPassed = passedPrayers.has(prayer);
        const isNext = nextPrayer?.prayer === prayer;
        const countdown =
          isNext && displayTime !== "N/A" ? getCountdown(displayTime) : null;

        return (
          <PrayerTimeCard
            key={prayer}
            prayerName={prayerNames[prayer] || prayer}
            time={displayTime}
            isPassed={isPassed}
            countdown={countdown}
          />
        );
      })}
    </div>
  );
};
