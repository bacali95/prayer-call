import React, { useState } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Alert } from "./ui/alert";
import { Config, Mosque, PrayerTimes } from "../types";

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
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || "Failed to search mosques";
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

  return (
    <div className="section">
      <h2 className="section-title">Select Mosque</h2>

      {error && (
        <Alert type="error" style={{ marginBottom: "15px" }}>
          {error}
        </Alert>
      )}

      <div className="section-content">
        <div className="search-box">
          <Input
            type="text"
            placeholder="Search for a mosque..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && searchMosques()}
            style={{ flex: 1 }}
          />
          <Button onClick={searchMosques} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>

        {config?.mosque && (
          <Card className="selected-info">
            <div className="mosque-name">Selected: {config.mosque.name}</div>
            {config.mosque.address && (
              <div className="mosque-address">{config.mosque.address}</div>
            )}
          </Card>
        )}

        {mosques.length > 0 && (
          <div className="mosque-list">
            {mosques.map((mosque) => (
              <Card
                key={mosque.uuid || mosque.id}
                className={`mosque-item ${
                  config?.mosque?.uuid === mosque.uuid ||
                  config?.mosque?.id === mosque.id
                    ? "selected"
                    : ""
                }`}
                onClick={() => selectMosque(mosque)}
              >
                <div className="mosque-name">{mosque.name}</div>
                {mosque.address && (
                  <div className="mosque-address">{mosque.address}</div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MosqueSelector;
