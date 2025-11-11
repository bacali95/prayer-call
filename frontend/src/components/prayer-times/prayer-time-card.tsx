import React from "react";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";

type PrayerTimeCardProps = {
  prayerName: string;
  time: string;
  hasFile: boolean;
  isScheduled: boolean;
  isPassed?: boolean;
  countdown?: string | null;
};

export const PrayerTimeCard: React.FC<PrayerTimeCardProps> = ({
  prayerName,
  time,
  hasFile,
  isScheduled,
  isPassed = false,
  countdown = null,
}) => {
  return (
    <Card
      className={cn(
        "p-4 border text-center bg-card transition-opacity duration-300 flex flex-col justify-center",
        isPassed && "opacity-40"
      )}
    >
      <div className="font-semibold mb-1.5 text-foreground">{prayerName}</div>
      <div className="text-lg text-primary mb-1">{time}</div>
      <div className="text-xs text-muted-foreground mt-1.5">
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
      {countdown && (
        <div className="flex flex-col items-center gap-1 mt-2.5 p-2 bg-primary/10 dark:bg-primary/20 rounded-md border border-primary/20">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <span>⏰</span>
            <span>Time remaining</span>
          </div>
          <div className="text-base font-bold text-primary">{countdown}</div>
        </div>
      )}
    </Card>
  );
};
