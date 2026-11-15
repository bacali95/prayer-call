import { lazy, Suspense, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useYear } from "@/hooks/use-api";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

const YearChart = lazy(() => import("@/components/today/year-chart"));

export function YearOverview({ mosqueId }: { mosqueId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const year = useYear(mosqueId, open);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="year-trigger">
          <span className="text-left">
            <span className="block font-display text-lg font-medium tracking-tight">Year overview</span>
            <span className="block text-sm font-normal text-muted-foreground">
              How prayer times move through the seasons
            </span>
          </span>
          <ChevronDown aria-hidden />
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <div className="px-5 pb-5">
            {year.isPending ? (
              <Skeleton className="h-72 w-full" />
            ) : year.isError ? (
              <ErrorState error={year.error} onRetry={() => void year.refetch()} title="Could not load the year" />
            ) : (
              <Suspense fallback={<Skeleton className="h-72 w-full" />}>
                <YearChart year={year.data} />
              </Suspense>
            )}
          </div>
        </CollapsiblePanel>
      </Collapsible>
    </Card>
  );
}
