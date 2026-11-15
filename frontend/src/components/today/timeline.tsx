import { useState } from "react";
import { Check, Circle, Pencil, Sunrise, Volume2, X } from "lucide-react";
import { PRAYERS, PRAYER_KEYS, isAdhanKey } from "@/lib/prayers";
import type { TimelineEntry } from "@/lib/schedule";
import type { Config, CronJob, FileInfo } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@ui-sdk/react/button";
import { Card } from "@/components/ui/card";
import { PrayerAssignment } from "@/components/adhan/prayer-assignment";
import { cn } from "@/lib/utils";

interface Props {
  entries: TimelineEntry[];
  config: Config;
  jobs: CronJob[] | undefined;
  files: FileInfo[] | undefined;
}

export function Timeline({ entries, config, jobs, files }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const byKey = new Map(entries.map((e) => [e.key, e]));

  return (
    <Card>
      <ol aria-label="Today's prayer times" className="divide-y divide-border">
        {PRAYER_KEYS.map((key) => {
          const entry = byKey.get(key);
          if (!entry) return null;
          const meta = PRAYERS[key];
          const job = jobs?.find((j) => j.prayer === key);
          const file = isAdhanKey(key) ? config.adhan_files?.[key] : null;
          const volume = isAdhanKey(key) ? config.adhan_volumes?.[key] : null;
          const isNext = entry.status === "next";
          const passed = entry.status === "passed";
          const isOpen = editing === key;

          return (
            <li
              key={key}
              aria-current={isNext ? "time" : undefined}
              className={cn("relative px-4 py-4 md:px-6", isNext && "bg-brass-soft/60")}
            >
              {isNext && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />}
              <div className="flex items-center gap-4">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full",
                    isNext && "bg-primary text-primary-foreground",
                    passed && "bg-success-soft text-success",
                    entry.status === "upcoming" && "bg-muted text-muted-foreground",
                  )}
                >
                  {key === "shuruq" ? (
                    <Sunrise className="size-4" />
                  ) : passed ? (
                    <Check className="size-4" />
                  ) : (
                    <Circle className="size-3 fill-current" />
                  )}
                </span>

                <div className={cn("min-w-0 flex-1", key === "shuruq" && "opacity-75")}>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className={cn("font-display text-xl font-medium", passed && !isNext && "text-muted-foreground")}>
                      {meta.en}
                    </span>
                    <span lang="ar" dir="rtl" className="text-lg text-muted-foreground">
                      {meta.ar}
                    </span>
                    {key === "shuruq" && <span className="text-xs text-muted-foreground">Sunrise</span>}
                    {isNext && <Badge tone="brass">Next</Badge>}
                  </div>
                  {meta.adhan && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-1">
                        <Volume2 className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{file ?? "No adhan assigned"}</span>
                        {file && (
                          <span className="num shrink-0">
                            {"· "}
                            {volume === null || volume === undefined ? "default volume" : `${Math.round(volume * 100)}%`}
                          </span>
                        )}
                      </span>
                      <ScheduleBadge job={job} passed={passed} hasFile={!!file} />
                    </p>
                  )}
                </div>

                <span
                  className={cn(
                    "font-display-num text-2xl font-medium",
                    isNext && "text-brass",
                    passed && !isNext && "text-muted-foreground",
                  )}
                >
                  {entry.time}
                </span>

                {meta.adhan && (
                  <Button
                    data-variant="ghost"
                    aria-label={isOpen ? `Close ${meta.en} settings` : `Edit ${meta.en} adhan`}
                    aria-expanded={isOpen}
                    onClick={() => setEditing(isOpen ? null : key)}
                  >
                    {isOpen ? <X aria-hidden /> : <Pencil aria-hidden />}
                  </Button>
                )}
              </div>
              {isOpen && isAdhanKey(key) && (
                <div className="mt-4 rounded-md border border-border bg-background/60 p-4 md:ml-13">
                  {files ? (
                    <PrayerAssignment prayer={key} files={files} config={config} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading adhan library…</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function ScheduleBadge({ job, passed, hasFile }: { job?: CronJob; passed: boolean; hasFile: boolean }) {
  if (job?.executed_today) return <Badge tone="success">Played today</Badge>;
  if (job) {
    return <Badge tone="success">Scheduled{job.planned_time ? ` ${job.planned_time}` : ""}</Badge>;
  }
  if (passed) return null;
  return <Badge tone={hasFile ? "danger" : "neutral"}>Not scheduled</Badge>;
}
