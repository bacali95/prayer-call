import { ADHAN_KEYS, PRAYERS } from "@/lib/prayers";
import { useConfig, useFiles } from "@/hooks/use-api";
import { FileLibrary } from "@/components/adhan/file-library";
import { PrayerAssignment } from "@/components/adhan/prayer-assignment";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

export default function AdhanPage() {
  const config = useConfig();
  const files = useFiles();

  return (
    <>
      <PageHeader title="Adhan" description="Manage your adhan recordings and choose which one plays for each prayer." />
      <div className="flex flex-col gap-10">
        <section aria-labelledby="assign-title">
          <h2 id="assign-title" className="mb-1 font-display text-xl font-medium tracking-tight">
            Per-prayer assignment
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Changes are saved as you make them. Shuruq (sunrise) has no adhan.
          </p>
          {config.isPending || files.isPending ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              {ADHAN_KEYS.map((k) => (
                <Skeleton key={k} className="h-24" />
              ))}
            </div>
          ) : config.isError ? (
            <ErrorState error={config.error} onRetry={() => void config.refetch()} />
          ) : files.isError ? (
            <ErrorState error={files.error} onRetry={() => void files.refetch()} title="Could not load the library" />
          ) : (
            <div className="flex flex-col gap-3">
              {ADHAN_KEYS.map((k) => (
                <Card key={k} className="p-4 md:p-5">
                  <div className="mb-3 flex items-baseline gap-3">
                    <h3 className="font-display text-lg font-medium">{PRAYERS[k].en}</h3>
                    <span lang="ar" dir="rtl" className="text-muted-foreground">
                      {PRAYERS[k].ar}
                    </span>
                  </div>
                  <PrayerAssignment prayer={k} files={files.data} config={config.data} />
                </Card>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="library-title">
          <h2 id="library-title" className="mb-4 font-display text-xl font-medium tracking-tight">
            Library
          </h2>
          <FileLibrary config={config.data} />
        </section>
      </div>
    </>
  );
}
