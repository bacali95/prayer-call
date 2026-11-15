import { useState } from "react";
import { FileAudio, Loader2, Play, Trash2, Upload } from "lucide-react";
import { Button } from "@ui-sdk/react/button";
import { FileInput, FileInputDropzone, FileInputTrigger } from "@ui-sdk/react/file-input";
import { Progress, ProgressTrack, ProgressIndicator } from "@ui-sdk/react/progress";
import { ApiError } from "@/lib/api";
import { ADHAN_KEYS, PRAYERS } from "@/lib/prayers";
import { useDeleteFile, useFiles, useTestPlay, useUploadFile } from "@/hooks/use-api";
import type { Config, FileInfo } from "@/lib/types";
import { formatBytes, pending } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

interface UploadState {
  id: number;
  name: string;
  progress: number;
  error?: string;
}

let uploadSeq = 0;

export function FileLibrary({ config }: { config: Config | undefined }) {
  const files = useFiles();
  const upload = useUploadFile();
  const del = useDeleteFile();
  const play = useTestPlay();
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [toDelete, setToDelete] = useState<FileInfo | null>(null);
  const speaker = config?.chromecast;
  const assignedTo = toDelete
    ? ADHAN_KEYS.filter((k) => config?.adhan_files?.[k] === toDelete.name).map((k) => PRAYERS[k].en)
    : [];

  const patch = (id: number, p: Partial<UploadState>) =>
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...p } : u)));

  const handleFiles = async (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      const id = ++uploadSeq;
      setUploads((l) => [...l, { id, name: file.name, progress: 0 }]);
      try {
        await upload.mutateAsync({ file, onProgress: (f) => patch(id, { progress: f }) });
        setUploads((l) => l.filter((u) => u.id !== id));
      } catch (e) {
        const message =
          e instanceof ApiError && e.status === 409
            ? `A file named ${file.name} already exists. Delete it first or rename the new file.`
            : e instanceof Error
              ? e.message
              : "Upload failed";
        patch(id, { error: message });
      }
    }
  };

  const reject = (rejected: Array<{ file: File; reasons: readonly string[] }>) =>
    setUploads((l) => [
      ...l,
      ...rejected.map(({ file }) => ({ id: ++uploadSeq, name: file.name, progress: 0, error: "Only .mp3 files are supported" })),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <FileInput
        multiple
        accept=".mp3,audio/mpeg"
        value={[]}
        onValueChange={(_v, details) => void handleFiles(details.added)}
        onReject={reject}
      >
        <FileInputDropzone>
          <Upload aria-hidden />
          <p>Drag and drop MP3 files here</p>
          <FileInputTrigger data-variant="solid">Choose files</FileInputTrigger>
        </FileInputDropzone>
      </FileInput>

      {uploads.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Uploads">
          {uploads.map((u) => (
            <li key={u.id} className="rounded-md border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{u.name}</span>
                {u.error ? (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    onClick={() => setUploads((l) => l.filter((x) => x.id !== u.id))}
                  >
                    Dismiss
                  </button>
                ) : (
                  <span className="num text-xs text-muted-foreground" aria-hidden>
                    {Math.round(u.progress * 100)}%
                  </span>
                )}
              </div>
              {u.error ? (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {u.error}
                </p>
              ) : (
                <Progress value={Math.round(u.progress * 100)} aria-label={`Uploading ${u.name}`} className="mt-2">
                  <ProgressTrack>
                    <ProgressIndicator />
                  </ProgressTrack>
                </Progress>
              )}
            </li>
          ))}
        </ul>
      )}

      {files.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : files.isError ? (
        <ErrorState error={files.error} onRetry={() => void files.refetch()} title="Could not load the library" />
      ) : files.data.length === 0 ? (
        <EmptyState icon={<FileAudio />} title="No adhan files yet">
          Upload an MP3 to get started.
        </EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {files.data.map((f) => {
              const playing = play.isPending && play.variables?.filename === f.name;
              return (
                <li key={f.name} className="flex items-center gap-3 p-3 md:px-4">
                  <FileAudio className="size-5 shrink-0 text-brass" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground num">{formatBytes(f.size)}</p>
                  </div>
                  <Button
                    data-size="sm"
                    disabled={!speaker || (play.isPending && !playing)}
                    title={speaker ? undefined : "Select a speaker first"}
                    onClick={() =>
                      speaker ? pending(play.mutateAsync({ chromecast_name: speaker.name, filename: f.name })) : undefined
                    }
                  >
                    {playing ? <Loader2 data-slot="spinner" aria-hidden /> : <Play aria-hidden />}
                    Test<span className="sr-only"> play {f.name}</span>
                  </Button>
                  <Button data-variant="destructive-ghost" aria-label={`Delete ${f.name}`} onClick={() => setToDelete(f)}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this adhan file?"
        confirmLabel="Delete forever"
        agentConfirm={`Permanently deletes the adhan file ${toDelete?.name ?? ""}`}
        description={
          <>
            <strong className="text-foreground">{toDelete?.name}</strong> will be removed from the library.
            {assignedTo.length > 0 ? (
              <>
                {" "}
                It is currently assigned to <strong className="text-foreground">{assignedTo.join(", ")}</strong>, which will
                have no adhan until you assign another file.
              </>
            ) : null}
          </>
        }
        onConfirm={() => del.mutateAsync(toDelete?.name ?? "")}
      />
    </div>
  );
}
