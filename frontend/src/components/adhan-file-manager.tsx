import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Alert } from "./ui/alert";
import { Config, FileInfo } from "../types";

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

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      e.target.value = ""; // Reset input
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
    <div className="section">
      <h2 className="section-title">Manage Adhan Files</h2>

      {error && (
        <Alert type="error" style={{ marginBottom: "12px" }}>
          {error}
        </Alert>
      )}

      <div className="section-content">
        <div className="file-upload-area">
          <input
            type="file"
            accept=".mp3,audio/mpeg"
            onChange={handleFileUpload}
            disabled={uploading}
            id="file-upload"
          />
          <label htmlFor="file-upload">
            {uploading ? "Uploading..." : "Click to upload MP3 file"}
          </label>
        </div>

        {files.length > 0 && (
          <div className="uploaded-files">
            <h3 style={{ marginBottom: "12px" }}>Uploaded Files</h3>
            {files.map((file) => (
              <Card key={file.name} className="file-item">
                <div>
                  <strong>{file.name}</strong>
                  <span className="text-muted-foreground ml-2.5">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <Button
                    size="sm"
                    onClick={() => testPlay(file.name)}
                    disabled={!config?.chromecast}
                  >
                    Test Play
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteFile(file.name)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="prayer-selector">
          <h3 style={{ marginBottom: "12px" }}>Assign Files to Prayers</h3>
          {PRAYERS.map((prayer) => {
            const selectedFile = config?.adhan_files?.[prayer.value];
            const volumePercent =
              config?.adhan_volumes?.[prayer.value] !== null &&
              config?.adhan_volumes?.[prayer.value] !== undefined
                ? Math.round((config.adhan_volumes[prayer.value] || 0) * 100)
                : null;

            return (
              <div key={prayer.value}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: 600,
                  }}
                >
                  {prayer.label}
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-end",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <Select
                      value={selectedFile || undefined}
                      onValueChange={(value) => {
                        handleSelectFile(prayer.value, value);
                      }}
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
                  <div style={{ width: "120px" }}>
                    <label className="block text-xs mb-1 text-muted-foreground">
                      Volume (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={volumePercent !== null ? volumePercent : ""}
                      onChange={(e) => {
                        const value =
                          e.target.value === ""
                            ? null
                            : parseInt(e.target.value, 10);
                        if (value === null || (value >= 0 && value <= 100)) {
                          handleVolumeChange(prayer.value, value);
                        }
                      }}
                      placeholder="Auto"
                      className="w-full px-2 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdhanFileManager;
