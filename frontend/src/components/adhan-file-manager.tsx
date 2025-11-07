import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Alert } from "./ui/alert";
import { Config, FileInfo } from "../types";
import { FileUploadArea } from "./adhan/file-upload-area";
import { FileList } from "./adhan/file-list";
import { PrayerFileSelector } from "./adhan/prayer-file-selector";

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
  apiBase: string;
};

const AdhanFileManager: React.FC<AdhanFileManagerProps> = ({
  config,
  updateConfig,
  apiBase,
}) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async (): Promise<void> => {
    try {
      const response = await axios.get<{ files: FileInfo[] }>(
        `${apiBase}/files`
      );
      setFiles(response.data.files || []);
    } catch (err) {
      console.error("Failed to load files:", err);
    }
  }, [apiBase]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileUpload = async (file: File): Promise<void> => {
    if (file.type !== "audio/mpeg" && !file.name.endsWith(".mp3")) {
      setError("Please upload an MP3 file");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`${apiBase}/files`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadFiles();
      setError(null);
    } catch (err) {
      setError("Failed to upload file");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (filename: string): Promise<void> => {
    if (!window.confirm(`Delete ${filename}?`)) return;

    try {
      await axios.delete(`${apiBase}/files/${filename}`);
      await loadFiles();

      // Remove from config if it was selected
      const adhanFiles = { ...config?.adhan_files };
      Object.keys(adhanFiles).forEach((prayer) => {
        if (adhanFiles[prayer] === filename) {
          adhanFiles[prayer] = null;
        }
      });
      await updateConfig({ adhan_files: adhanFiles });
    } catch (err) {
      setError("Failed to delete file");
      console.error(err);
    }
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

  const testPlay = async (filename: string, prayer?: string): Promise<void> => {
    if (!config?.chromecast) {
      setError("Please select a Chromecast first");
      return;
    }

    try {
      // Get volume for this prayer if available
      let volume: number | null = null;
      if (
        prayer &&
        config?.adhan_volumes?.[prayer] !== null &&
        config?.adhan_volumes?.[prayer] !== undefined
      ) {
        volume = config.adhan_volumes[prayer];
      }

      await axios.post(`${apiBase}/test/play`, {
        chromecast_name: config.chromecast.name,
        filename: filename,
        volume: volume,
      });
      setError(null);
    } catch (err) {
      setError("Failed to play adhan");
      console.error(err);
    }
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
        <FileUploadArea onFileSelect={handleFileUpload} uploading={uploading} />

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
