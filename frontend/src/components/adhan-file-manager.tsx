import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "./ui/alert";
import { Config } from "../types";
import { FileUploadArea } from "./adhan/file-upload-area";
import { FileList } from "./adhan/file-list";
import { PrayerFileSelector } from "./adhan/prayer-file-selector";
import { api } from "../lib/api";

const PRAYERS = [
  { value: "fajr", label: "Fajr" },
  { value: "dhuhr", label: "Dhuhr" },
  { value: "asr", label: "Asr" },
  { value: "maghrib", label: "Maghrib" },
  { value: "isha", label: "Isha" },
] as const;

type AdhanFileManagerProps = {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => Promise<boolean>;
};

const AdhanFileManager: React.FC<AdhanFileManagerProps> = ({
  config,
  updateConfig,
}) => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: filesData } = useQuery({
    queryKey: ["files"],
    queryFn: async () => {
      const data = await api.getFiles();
      return data.files || [];
    },
  });

  const files = filesData || [];

  const uploadFileMutation = useMutation({
    mutationFn: (file: File) => api.uploadFile(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setError(null);
    },
    onError: (err) => {
      setError("Failed to upload file");
      console.error(err);
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (filename: string) => api.deleteFile(filename),
    onSuccess: async (_, filename) => {
      queryClient.invalidateQueries({ queryKey: ["files"] });

      // Remove from config if it was selected
      const adhanFiles = { ...config?.adhan_files };
      Object.keys(adhanFiles).forEach((prayer) => {
        if (adhanFiles[prayer] === filename) {
          adhanFiles[prayer] = null;
        }
      });
      await updateConfig({ adhan_files: adhanFiles });
      setError(null);
    },
    onError: (err) => {
      setError("Failed to delete file");
      console.error(err);
    },
  });

  const handleFileUpload = async (file: File): Promise<void> => {
    if (file.type !== "audio/mpeg" && !file.name.endsWith(".mp3")) {
      setError("Please upload an MP3 file");
      return;
    }

    setError(null);
    uploadFileMutation.mutate(file);
  };

  const handleDeleteFile = async (filename: string): Promise<void> => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    deleteFileMutation.mutate(filename);
  };

  const handleSelectFile = async (
    prayer: string,
    filename: string
  ): Promise<void> => {
    const adhanFiles = { ...config?.adhan_files };
    adhanFiles[prayer] = filename;
    await updateConfig({ adhan_files: adhanFiles });
  };

  const handleVolumeChange = async (
    prayer: string,
    volume: number | null
  ): Promise<void> => {
    const adhanVolumes = { ...config?.adhan_volumes };
    // Convert from 0-100 to 0.0-1.0 for storage
    adhanVolumes[prayer] = volume !== null ? volume / 100 : null;
    await updateConfig({ adhan_volumes: adhanVolumes });
  };

  const testPlayMutation = useMutation({
    mutationFn: (data: {
      chromecast_name: string;
      filename: string;
      volume?: number | null;
    }) => api.testPlay(data),
    onSuccess: () => {
      setError(null);
    },
    onError: (err) => {
      setError("Failed to play adhan");
      console.error(err);
    },
  });

  const testPlay = async (filename: string, prayer?: string): Promise<void> => {
    if (!config?.chromecast) {
      setError("Please select a Chromecast first");
      return;
    }

    // Get volume for this prayer if available
    let volume: number | null = null;
    if (
      prayer &&
      config?.adhan_volumes?.[prayer] !== null &&
      config?.adhan_volumes?.[prayer] !== undefined
    ) {
      volume = config.adhan_volumes[prayer];
    }

    testPlayMutation.mutate({
      chromecast_name: config.chromecast.name,
      filename: filename,
      volume: volume,
    });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3 text-foreground">
        Manage Adhan Files
      </h2>

      {error && (
        <Alert type="error" className="mb-3">
          {error}
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <FileUploadArea
          onFileSelect={handleFileUpload}
          uploading={uploadFileMutation.isPending}
        />

        <FileList
          files={files}
          onTestPlay={(filename) => testPlay(filename)}
          onDelete={handleDeleteFile}
          canTestPlay={!!config?.chromecast}
        />

        <div className="flex flex-col gap-3">
          <h3 className="mb-3">Assign Files to Prayers</h3>
          {PRAYERS.map((prayer) => {
            const selectedFile = config?.adhan_files?.[prayer.value];
            const volumePercent =
              config?.adhan_volumes?.[prayer.value] !== null &&
              config?.adhan_volumes?.[prayer.value] !== undefined
                ? Math.round((config.adhan_volumes[prayer.value] || 0) * 100)
                : null;

            return (
              <PrayerFileSelector
                key={prayer.value}
                prayer={prayer}
                files={files}
                selectedFile={selectedFile}
                volumePercent={volumePercent}
                onFileSelect={handleSelectFile}
                onVolumeChange={handleVolumeChange}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdhanFileManager;
