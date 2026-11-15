import { useConfig, useCronJobs, useFiles } from "@/hooks/use-api";
import { useNow } from "@/hooks/use-now";
import { buildTimeline, getNextPrayer } from "@/lib/schedule";
import { Hero } from "@/components/today/hero";
import { Timeline } from "@/components/today/timeline";
import { SetupChecklist } from "@/components/today/setup-checklist";
import { YearOverview } from "@/components/today/year-overview";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

export default function TodayPage() {
  const config = useConfig();
  const jobs = useCronJobs();
  const files = useFiles();
  const now = useNow(1000);

  if (config.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading today">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (config.isError) {
    return <ErrorState error={config.error} onRetry={() => void config.refetch()} title="Could not load your configuration" />;
  }

  const cfg = config.data;
  const times = cfg.prayer_times;
  const next = getNextPrayer(times, now);
  const timeline = buildTimeline(times, now);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Today</h1>
      <Hero config={cfg} next={next} now={now} />
      <SetupChecklist config={cfg} />
      {timeline.length > 0 && (
        <section aria-labelledby="timeline-title">
          <h2 id="timeline-title" className="mb-3 font-display text-xl font-medium tracking-tight">
            Today's prayers
          </h2>
          <Timeline entries={timeline} config={cfg} jobs={jobs.data} files={files.data} />
          {jobs.isError && (
            <p className="mt-2 text-sm text-muted-foreground">Schedule status is unavailable right now.</p>
          )}
        </section>
      )}
      {cfg.mosque && <YearOverview mosqueId={cfg.mosque.uuid ?? cfg.mosque.id} />}
    </div>
  );
}
