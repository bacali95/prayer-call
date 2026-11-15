import { useState } from "react";
import { Check, Landmark, MapPin, RefreshCw } from "lucide-react";
import { useConfig, useRefreshTimes, useSearchMosques, useSelectMosque } from "@/hooks/use-api";
import { useDebounced } from "@/hooks/use-debounced";
import type { Mosque } from "@/lib/types";
import { PRAYER_KEYS, PRAYERS } from "@/lib/prayers";
import { pending } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

const idOf = (m: Mosque) => m.uuid ?? m.id;

function MosqueName({ name }: { name: string }) {
  return <span lang={/[؀-ۿ]/.test(name) ? "ar" : undefined}>{name}</span>;
}

export default function MosquePage() {
  const config = useConfig();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim());
  const search = useSearchMosques(debounced);
  const select = useSelectMosque();
  const refresh = useRefreshTimes();

  const selected = config.data?.mosque;
  const selectedId = selected ? idOf(selected) : undefined;
  const times = config.data?.prayer_times;
  const searching = query.trim().length >= 2 && (query.trim() !== debounced || search.isFetching);

  return (
    <>
      <PageHeader title="Mosque" description="Prayer times come from Mawaqit. Search for your mosque by name or city." />

      <div className="flex flex-col gap-6">
        {config.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : config.isError ? (
          <ErrorState error={config.error} onRetry={() => void config.refetch()} />
        ) : selected ? (
          <Card className="pattern-star overflow-hidden">
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Badge tone="success">
                    <Check aria-hidden /> Selected mosque
                  </Badge>
                  <h2 className="mt-2 font-display text-2xl font-medium">
                    <MosqueName name={selected.name} />
                  </h2>
                  {selected.address && (
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {selected.address}
                    </p>
                  )}
                </div>
                <Button disabled={!selectedId} onClick={() => (selectedId ? pending(refresh.mutateAsync(selectedId)) : undefined)}>
                  <RefreshCw aria-hidden /> Refresh times
                </Button>
              </div>
              {times && (
                <dl className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {PRAYER_KEYS.filter((k) => times[k]).map((k) => (
                    <div key={k} className="rounded-md bg-muted/70 px-3 py-2">
                      <dt className="text-xs text-muted-foreground">{PRAYERS[k].en}</dt>
                      <dd className="font-display-num text-lg">{times[k]}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        ) : null}

        <section aria-labelledby="search-title" className="flex flex-col gap-4">
          <h2 id="search-title" className="font-display text-xl font-medium tracking-tight">
            {selected ? "Change mosque" : "Find your mosque"}
          </h2>
          <Field>
            <FieldLabel>Search mosques</FieldLabel>
            <Input
              type="search"
              placeholder="Mosque name or city"
              value={query}
              onValueChange={(v) => setQuery(v)}
            />
          </Field>

          <div aria-live="polite">
            {searching ? (
              <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : search.isError ? (
              <ErrorState error={search.error} onRetry={() => void search.refetch()} title="Search failed" />
            ) : search.data && search.data.length === 0 ? (
              <EmptyState icon={<Landmark />} title="No mosques found">
                Try a different spelling or a nearby city.
              </EmptyState>
            ) : search.data ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {search.data.map((m) => {
                  const id = idOf(m);
                  const isSelected = !!id && id === selectedId;
                  const busy = select.isPending && select.variables && idOf(select.variables) === id;
                  return (
                    <li key={id ?? m.name}>
                      <Card className="flex h-full flex-col justify-between gap-3 p-4">
                        <div>
                          <p className="font-medium">
                            <MosqueName name={m.name} />
                          </p>
                          {m.address && <p className="mt-1 text-sm text-muted-foreground">{m.address}</p>}
                        </div>
                        <Button
                          data-variant={isSelected ? undefined : "solid"}
                          data-size="sm"
                          className="self-start"
                          disabled={isSelected || (select.isPending && !busy)}
                          aria-label={`${isSelected ? "Selected" : "Select"} ${m.name}`}
                          onClick={() => pending(select.mutateAsync(m))}
                        >
                          {isSelected ? (
                            <>
                              <Check aria-hidden /> Selected
                            </>
                          ) : (
                            "Select"
                          )}
                        </Button>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Type at least two characters to search.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
