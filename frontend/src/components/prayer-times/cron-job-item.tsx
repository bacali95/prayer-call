import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

type CronJobItemProps = {
  prayerName: string;
  plannedTime?: string | null;
  command?: string;
  lastRun: string | null | undefined;
  executedToday?: boolean;
  onViewLogs: () => void;
  onRemove: () => void;
  loadingLogs?: boolean;
};

export const CronJobItem: React.FC<CronJobItemProps> = ({
  prayerName,
  plannedTime,
  command,
  lastRun,
  executedToday = false,
  onViewLogs,
  onRemove,
  loadingLogs = false,
}) => {
  const formatLastRun = (lastRun: string | null | undefined): string => {
    if (!lastRun) return "Never";
    try {
      const date = new Date(lastRun);
      return date.toLocaleString();
    } catch {
      return "Unknown";
    }
  };

  const formatTime = (timeStr: string | null | undefined): string => {
    if (!timeStr) return "N/A";
    try {
      const [hour, minute] = timeStr.split(":");
      const hourNum = parseInt(hour, 10);
      const minuteNum = parseInt(minute, 10);
      if (!isNaN(hourNum) && !isNaN(minuteNum)) {
        const period = hourNum >= 12 ? "PM" : "AM";
        const displayHour =
          hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
        const displayMinute = minuteNum.toString().padStart(2, "0");
        return `${displayHour}:${displayMinute} ${period}`;
      }
    } catch {
      return timeStr;
    }
    return timeStr;
  };

  return (
    <Card className="p-4 text-sm">
      <div className="flex flex-col justify-between items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <strong className="text-base">{prayerName}</strong>
            {executedToday && (
              <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">
                ✓ Executed Today
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground min-w-[100px]">
                Planned Time:
              </span>
              <span className="font-medium">{formatTime(plannedTime)}</span>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-muted-foreground min-w-[100px]">
                Command:
              </span>
              <span className="font-mono text-xs break-all">{command}</span>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-muted-foreground min-w-[100px]">
                Last Run:
              </span>
              <span>{formatLastRun(lastRun)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={onViewLogs}
            disabled={loadingLogs || !lastRun}
          >
            {loadingLogs ? "Loading..." : "View Logs"}
          </Button>
          <Button variant="destructive" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
    </Card>
  );
};
