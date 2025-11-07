import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import { FileInfo } from "../../types";

type PrayerFileSelectorProps = {
  prayer: { value: string; label: string };
  files: FileInfo[];
  selectedFile?: string | null;
  volumePercent: number | null;
  onFileSelect: (prayer: string, filename: string) => void;
  onVolumeChange: (prayer: string, volume: number | null) => void;
};

export const PrayerFileSelector: React.FC<PrayerFileSelectorProps> = ({
  prayer,
  files,
  selectedFile,
  volumePercent,
  onFileSelect,
  onVolumeChange,
}) => {
  return (
    <div>
      <label className="block mb-2 font-semibold">{prayer.label}</label>
      <div className="flex gap-2.5 items-end">
        <div className="flex-1">
          <label className="block text-xs mb-1 text-muted-foreground">
            File
          </label>
          <Select
            value={selectedFile || undefined}
            onValueChange={(value) => onFileSelect(prayer.value, value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a file..." />
            </SelectTrigger>
            <SelectContent>
              {files.map((file) => (
                <SelectItem key={file.name} value={file.name}>
                  {file.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[120px]">
          <label className="block text-xs mb-1 text-muted-foreground">
            Volume (%)
          </label>
          <Input
            type="number"
            min="0"
            max="100"
            step="1"
            value={volumePercent !== null ? volumePercent : ""}
            onChange={(e) => {
              const value =
                e.target.value === "" ? null : parseInt(e.target.value, 10);
              if (value === null || (value >= 0 && value <= 100)) {
                onVolumeChange(prayer.value, value);
              }
            }}
            placeholder="Auto"
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};
