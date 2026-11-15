import { useEffect, useMemo, useRef, useState } from "react";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-sdk/react/select";
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@ui-sdk/react/slider";
import { PRAYERS, type AdhanKey } from "@/lib/prayers";
import type { Config, FileInfo } from "@/lib/types";
import { useUpdateConfig } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const NONE = "__none__";

interface Props {
  prayer: AdhanKey;
  files: FileInfo[];
  config: Config;
  className?: string;
}

/**
 * File select + volume slider for one prayer. Each change sends a partial
 * update containing only the changed key (POST /api/config merges them).
 */
export function PrayerAssignment({ prayer, files, config, className }: Props) {
  const meta = PRAYERS[prayer];
  const update = useUpdateConfig(`${meta.en} saved`);
  const savedFile = config.adhan_files?.[prayer] ?? NONE;
  const savedVolume = config.adhan_volumes?.[prayer] ?? null;

  const [volume, setVolume] = useState<number | null>(savedVolume);
  const [prevSaved, setPrevSaved] = useState(savedVolume);
  if (prevSaved !== savedVolume) {
    setPrevSaved(savedVolume);
    setVolume(savedVolume);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onVolume = (value: number) => {
    setVolume(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update.mutate({ adhan_volumes: { [prayer]: Math.round(value * 100) / 100 } }), 400);
  };

  const items = useMemo(() => {
    const list = [{ value: NONE, label: "No adhan (silent)" }, ...files.map((f) => ({ value: f.name, label: f.name }))];
    // A file removed from the library but still referenced stays visible.
    if (savedFile !== NONE && !files.some((f) => f.name === savedFile)) {
      list.push({ value: savedFile, label: `${savedFile} (missing)` });
    }
    return list;
  }, [files, savedFile]);

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 sm:items-end", className)}>
      <Field>
        <FieldLabel>{meta.en} adhan file</FieldLabel>
        <Select
          items={items}
          value={savedFile}
          disabled={update.isPending}
          onValueChange={(v) => {
            if (typeof v === "string" && v !== savedFile) {
              update.mutate({ adhan_files: { [prayer]: v === NONE ? null : v } });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium text-muted-foreground" aria-hidden>
            {meta.en} volume
          </span>
          <span className="num text-muted-foreground" aria-hidden>
            {volume === null ? "Speaker default" : `${Math.round(volume * 100)}%`}
          </span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={volume ?? 0.5}
          onValueChange={(v) => onVolume(v as number)}
        >
          <SliderControl>
            <SliderTrack>
              <SliderIndicator />
              <SliderThumb aria-label={`${meta.en} volume`} />
            </SliderTrack>
          </SliderControl>
        </Slider>
      </div>
    </div>
  );
}
