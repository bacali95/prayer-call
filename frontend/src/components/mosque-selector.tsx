import React, { useState } from "react";
import axios from "axios";
import { Alert } from "./ui/alert";
import { Config, Mosque, PrayerTimes } from "../types";
import { SearchBox } from "./shared/search-box";
import { SelectedInfo } from "./shared/selected-info";
import { DeviceList } from "./shared/device-list";

type MosqueSelectorProps = {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => Promise<boolean>;
  apiBase: string;
};

const MosqueSelector: React.FC<MosqueSelectorProps> = ({
  config,
  updateConfig,
  apiBase,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const searchMosques = async (): Promise<void> => {
    if (!searchQuery.trim()) {
      setError("Please enter a search query");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<{ mosques: Mosque[] }>(
        `${apiBase}/mosques/search`,
        {
          params: { q: searchQuery },
        }
      );
      const mosques = response.data.mosques || [];
      setMosques(mosques);
      if (mosques.length === 0) {
        setError("No mosques found. Try a different search term.");
      }
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { error?: string }; message?: string } })
          .response?.data?.error ||
        (err as { message?: string }).message ||
        "Failed to search mosques";
      setError(errorMessage);
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectMosque = async (mosque: Mosque): Promise<void> => {
    try {
      // Get prayer times for this mosque
      const prayerTimesResponse = await axios.get<PrayerTimes>(
        `${apiBase}/mosques/${mosque.uuid || mosque.id}/prayer-times`
      );

      const success = await updateConfig({
        mosque: mosque,
        prayer_times: prayerTimesResponse.data,
      });

      if (success) {
        setError(null);
      }
    } catch (err) {
      setError("Failed to select mosque or get prayer times");
      console.error(err);
    }
  };

  const selectedMosqueId =
    config?.mosque?.uuid || config?.mosque?.id || undefined;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3 text-foreground">
        Select Mosque
      </h2>

      {error && (
        <Alert type="error" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <SearchBox
          value={searchQuery}
          onChange={setSearchQuery}
          onSearch={searchMosques}
          placeholder="Search for a mosque..."
          loading={loading}
        />

        {config?.mosque && (
          <SelectedInfo
            title={`Selected: ${config.mosque.name}`}
            subtitle={config.mosque.address}
          />
        )}

        <DeviceList
          devices={mosques.map((mosque) => ({
            id: mosque.uuid || mosque.id || "",
            name: mosque.name,
            subtitle: mosque.address,
          }))}
          selectedId={selectedMosqueId}
          onSelect={(device) => {
            const mosque = mosques.find((m) => (m.uuid || m.id) === device.id);
            if (mosque) selectMosque(mosque);
          }}
        />
      </div>
    </div>
  );
};

export default MosqueSelector;
