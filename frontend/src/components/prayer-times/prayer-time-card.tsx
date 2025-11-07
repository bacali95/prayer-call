import React from "react";
import { Card } from "../ui/card";

type PrayerTimeCardProps = {
  prayerName: string;
  time: string;
  hasFile: boolean;
  isScheduled: boolean;
};

export const PrayerTimeCard: React.FC<PrayerTimeCardProps> = ({
  prayerName,
  time,
  hasFile,
  isScheduled,
}) => {
  return (
    <Card className="p-4 border text-center bg-card">
      <div className="font-semibold mb-2.5 text-foreground">{prayerName}</div>
      <div className="text-lg text-primary mb-2.5">{time}</div>
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
};
