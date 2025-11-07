import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

type CronJobItemProps = {
  prayerName: string;
  schedule: string;
  lastRun: string | null | undefined;
  onViewLogs: () => void;
  onRemove: () => void;
  loadingLogs?: boolean;
};

export const CronJobItem: React.FC<CronJobItemProps> = ({
  prayerName,
  schedule,
  lastRun,
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

  return (
    <Card className="p-4 text-sm">
      <div className="flex justify-between items-center mb-2">
        <div>
          <strong>{prayerName}:</strong> {schedule}
        </div>
        <div className="flex gap-2">
          {lastRun && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewLogs}
              disabled={loadingLogs}
            >
              {loadingLogs ? "Loading..." : "View Logs"}
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        Last run: {formatLastRun(lastRun)}
      </div>
    </Card>
  );
};
