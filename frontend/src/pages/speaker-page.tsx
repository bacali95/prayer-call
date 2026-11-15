import { Check, Loader2, Radar, Speaker as SpeakerIcon } from "lucide-react";
import { useConfig, useScanSpeakers, useUpdateConfig } from "@/hooks/use-api";
import { describeDevice } from "@/lib/devices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@ui-sdk/react/button";
import { pending } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

export default function SpeakerPage() {
  const config = useConfig();
  const scan = useScanSpeakers();
  const update = useUpdateConfig("Speaker saved");
  const selected = config.data?.chromecast;

  return (
    <>
      <PageHeader
        title="Speaker"
        description="The Chromecast or Google speaker that plays the adhan. Make sure it is on the same network."
        actions={
          <Button data-variant="solid" onClick={() => pending(scan.mutateAsync())} pendingAnnouncement="Scanning for speakers">
            <Radar aria-hidden data-show="idle" />
            <Loader2 aria-hidden data-slot="spinner" data-show="pending" />
            <span data-show="idle">Scan for speakers</span>
            <span data-show="pending">Scanning…</span>
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        {config.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : config.isError ? (
          <ErrorState error={config.error} onRetry={() => void config.refetch()} />
        ) : (
          <section aria-labelledby="current-title">
            <h2 id="current-title" className="mb-3 font-display text-xl font-medium tracking-tight">
              Current speaker
            </h2>
            {selected ? (
              <Card className="flex items-center gap-4 p-4">
                <span className="grid size-11 place-items-center rounded-full bg-success-soft text-success">
                  <SpeakerIcon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{selected.name}</p>
                  <p className="text-sm text-muted-foreground">{describeDevice(selected)}</p>
                </div>
              </Card>
            ) : (
              <EmptyState icon={<SpeakerIcon />} title="No speaker selected">
                Scan the network and choose the device that should play the adhan.
              </EmptyState>
            )}
          </section>
        )}

        <section aria-labelledby="found-title" aria-live="polite">
          <h2 id="found-title" className="mb-3 font-display text-xl font-medium tracking-tight">
            Devices on your network
          </h2>
          {scan.isPending ? (
            <div aria-busy="true">
              <p className="mb-3 text-sm text-muted-foreground">Listening for devices. This takes about ten seconds.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            </div>
          ) : scan.isError ? (
            <ErrorState error={scan.error} onRetry={() => void pending(scan.mutateAsync())} title="Scan failed" />
          ) : scan.data ? (
            scan.data.length === 0 ? (
              <EmptyState icon={<Radar />} title="No devices found">
                Check the speaker is powered on and on the same Wi-Fi, then scan again.
              </EmptyState>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {scan.data.map((d) => {
                  const isSelected = selected?.uuid === d.uuid;
                  const busy = update.isPending && update.variables?.chromecast?.uuid === d.uuid;
                  return (
                    <li key={d.uuid}>
                      <Card className="flex h-full flex-col justify-between gap-3 p-4">
                        <div>
                          <p className="font-medium">{d.name}</p>
                          <p className="text-sm text-muted-foreground">{describeDevice(d)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            data-size="sm"
                            data-variant={isSelected ? undefined : "solid"}
                            disabled={isSelected || (update.isPending && !busy)}
                            aria-label={`${isSelected ? "Selected" : "Use"} ${d.name}`}
                            onClick={() => pending(update.mutateAsync({ chromecast: d }))}
                          >
                            {isSelected ? (
                              <>
                                <Check aria-hidden /> Selected
                              </>
                            ) : (
                              "Use this speaker"
                            )}
                          </Button>
                          {isSelected && <Badge tone="success">Active</Badge>}
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Press “Scan for speakers” to look for devices.</p>
          )}
        </section>
      </div>
    </>
  );
}
