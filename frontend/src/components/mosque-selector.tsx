import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert } from "./ui/alert";
import { Config, Mosque } from "../types";
import { SearchBox } from "./shared/search-box";
import { SelectedInfo } from "./shared/selected-info";
import { DeviceList } from "./shared/device-list";
import { api } from "../lib/api";

type MosqueSelectorProps = {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => Promise<boolean>;
};

const MosqueSelector: React.FC<MosqueSelectorProps> = ({
  config,
  updateConfig,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [error, setError] = useState<string | null>(null);

  const searchMosquesMutation = useMutation({
    mutationFn: (query: string) => api.searchMosques(query),
    onSuccess: (data) => {
      const mosques = data.mosques || [];
      setMosques(mosques);
      if (mosques.length === 0) {
        setError("No mosques found. Try a different search term.");
      } else {
        setError(null);
      }
    },
    onError: (err: unknown) => {
      const errorMessage =
        (err as { message?: string }).message || "Failed to search mosques";
      setError(errorMessage);
      console.error("Search error:", err);
    },
  });

  const getPrayerTimesMutation = useMutation({
    mutationFn: (mosqueId: string) => api.getPrayerTimes(mosqueId),
    onError: () => {
      setError("Failed to select mosque or get prayer times");
    },
  });

  const searchMosques = async (): Promise<void> => {
    if (!searchQuery.trim()) {
      setError("Please enter a search query");
      return;
    }

    setError(null);
    searchMosquesMutation.mutate(searchQuery);
  };

  const selectMosque = async (mosque: Mosque): Promise<void> => {
    try {
      const mosqueId = mosque.uuid || mosque.id;
      if (!mosqueId) {
        setError("Invalid mosque ID");
        return;
      }

      const prayerTimes = await getPrayerTimesMutation.mutateAsync(mosqueId);

      const success = await updateConfig({
        mosque: mosque,
        prayer_times: prayerTimes,
      });

      if (success) {
        setError(null);
      }
    } catch (err) {
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
          loading={searchMosquesMutation.isPending}
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
