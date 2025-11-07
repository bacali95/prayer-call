import React from "react";
import { CronJobItem } from "./cron-job-item";
import { CronJob } from "../../types";

type CronJobListProps = {
  cronJobs: CronJob[];
  prayerNames: Record<string, string>;
  onViewLogs: (prayer: string) => void;
  onRemove: (prayer: string) => void;
  loadingLogs?: boolean;
};

export const CronJobList: React.FC<CronJobListProps> = ({
  cronJobs,
  prayerNames,
  onViewLogs,
  onRemove,
  loadingLogs = false,
}) => {
  if (cronJobs.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="mb-4">Scheduled Jobs</h3>
      <div className="flex flex-col gap-2.5">
        {cronJobs.map((job, index) => (
          <CronJobItem
            key={index}
            prayerName={prayerNames[job.prayer] || job.prayer}
            schedule={job.schedule}
            lastRun={job.last_run}
            onViewLogs={() => onViewLogs(job.prayer)}
            onRemove={() => onRemove(job.prayer)}
            loadingLogs={loadingLogs}
          />
        ))}
      </div>
    </div>
  );
};
