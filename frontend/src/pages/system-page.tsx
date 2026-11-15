import { useState } from "react";
import { FileText, Timer, Trash2 } from "lucide-react";
import { useCronJobs, useCronLogs, useDeleteCronJob, useVersion } from "@/hooks/use-api";
import { PRAYERS, isAdhanKey, isPrayerKey } from "@/lib/prayers";
import type { CronJob } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@ui-sdk/react/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

function formatLastRun(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Unknown" : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function Logs({ prayer }: { prayer: string }) {
  const logs = useCronLogs(prayer);
  if (logs.isPending) return <Skeleton className="mt-3 h-24" />;
  if (logs.isError) {
    return <p className="mt-3 text-sm text-muted-foreground">{logs.error.message}</p>;
  }
  return (
    <pre
      tabIndex={0}
      aria-label={`Logs for ${prayer}`}
      className="mt-3 max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words"
    >
      {logs.data.logs || "The log is empty."}
    </pre>
  );
}

export default function SystemPage() {
  const jobs = useCronJobs();
  const version = useVersion();
  const del = useDeleteCronJob();
  const [openLogs, setOpenLogs] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CronJob | null>(null);

  const label = (p: string) => (isPrayerKey(p) ? PRAYERS[p].en : p);

  return (
    <>
      <PageHeader title="System" description="Scheduled adhan jobs, their logs, and app details." />
      <div className="flex flex-col gap-8">
        <section aria-labelledby="jobs-title">
          <h2 id="jobs-title" className="mb-3 font-display text-xl font-medium tracking-tight">
            Scheduled jobs
          </h2>
          {jobs.isPending ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : jobs.isError ? (
            <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />
          ) : jobs.data.length === 0 ? (
            <EmptyState icon={<Timer />} title="Nothing scheduled">
              Jobs appear once a mosque and a speaker are set.
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {jobs.data.map((job) => {
                const open = openLogs === job.prayer;
                return (
                  <li key={job.prayer}>
                    <Card className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-lg font-medium">{label(job.prayer)}</h3>
                            {job.executed_today && <Badge tone="success">Ran today</Badge>}
                          </div>
                          <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                            <div className="flex gap-1.5">
                              <dt>Planned</dt>
                              <dd className="num text-foreground">{job.planned_time ?? "n/a"}</dd>
                            </div>
                            <div className="flex gap-1.5">
                              <dt>Cron</dt>
                              <dd className="font-mono text-foreground">{job.schedule}</dd>
                            </div>
                            <div className="flex gap-1.5">
                              <dt>Last run</dt>
                              <dd className="text-foreground">{formatLastRun(job.last_run)}</dd>
                            </div>
                          </dl>
                        </div>
                        <div className="flex gap-2">
                          <Button data-size="sm" aria-expanded={open} onClick={() => setOpenLogs(open ? null : job.prayer)}>
                            <FileText aria-hidden /> {open ? "Hide logs" : "Logs"}
                            <span className="sr-only"> for {label(job.prayer)}</span>
                          </Button>
                          {isAdhanKey(job.prayer) && (
                            <Button data-size="sm" data-variant="destructive-ghost" onClick={() => setToDelete(job)}>
                              <Trash2 aria-hidden /> Delete<span className="sr-only"> {label(job.prayer)} job</span>
                            </Button>
                          )}
                        </div>
                      </div>
                      {open && <Logs prayer={job.prayer} />}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="about-title">
          <h2 id="about-title" className="mb-3 font-display text-xl font-medium tracking-tight">
            About
          </h2>
          <Card className="p-4 text-sm">
            <dl className="flex gap-2">
              <dt className="text-muted-foreground">App version</dt>
              <dd className="num font-medium">{version.data?.version ?? (version.isError ? "unavailable" : "…")}</dd>
            </dl>
          </Card>
        </section>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this scheduled job?"
        confirmLabel="Delete job"
        agentConfirm={`Removes the scheduled ${toDelete ? label(toDelete.prayer) : ""} adhan job`}
        description={
          <>
            The {toDelete ? label(toDelete.prayer) : ""} adhan will not play today. Jobs are recreated the next time prayer
            times are refreshed.
          </>
        }
        onConfirm={() => del.mutateAsync(toDelete?.prayer ?? "")}
      />
    </>
  );
}
