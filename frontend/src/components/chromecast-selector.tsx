import React, { useState } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Alert } from "./ui/alert";
import { Config, ChromecastDevice } from "../types";

type ChromecastSelectorProps = {
  config: Config | null;
  updateConfig: (updates: Partial<Config>) => Promise<boolean>;
  apiBase: string;
};

const ChromecastSelector: React.FC<ChromecastSelectorProps> = ({
  config,
  updateConfig,
  apiBase,
}) => {
  const [devices, setDevices] = useState<ChromecastDevice[]>([]);
  const [scanning, setScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const scanForDevices = async (): Promise<void> => {
    setScanning(true);
    setError(null);

    try {
      const response = await axios.get<{ devices: ChromecastDevice[] }>(
        `${apiBase}/chromecasts/scan`,
        {
          params: { timeout: 60 },
        }
      );
      setDevices(response.data.devices || []);
    } catch (err) {
      setError("Failed to scan for Chromecast devices");
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const selectDevice = async (device: ChromecastDevice): Promise<void> => {
    const success = await updateConfig({ chromecast: device });
    if (success) {
      setError(null);
    }
  };

  return (
    <div className="section">
      <h2 className="section-title">Select Chromecast</h2>

      {error && (
        <Alert type="error" style={{ marginBottom: "15px" }}>
          {error}
        </Alert>
      )}

      <div className="section-content">
        <Button onClick={scanForDevices} disabled={scanning}>
          {scanning ? "Scanning..." : "Scan for Chromecast Devices"}
        </Button>

        {config?.chromecast && (
          <Card className="selected-info">
            <div className="mosque-name">
              Selected: {config.chromecast.name}
            </div>
            <div className="mosque-address">
              Model: {config.chromecast.model_name || "Unknown"}
            </div>
          </Card>
        )}

        {devices.length > 0 && (
          <div className="mosque-list">
            {devices.map((device) => (
              <Card
                key={device.uuid}
                className={`mosque-item ${
                  config?.chromecast?.uuid === device.uuid ? "selected" : ""
                }`}
                onClick={() => selectDevice(device)}
              >
                <div className="mosque-name">{device.name}</div>
                <div className="mosque-address">
                  {device.model_name} • {device.cast_type}
                </div>
              </Card>
            ))}
          </div>
        )}

        {devices.length === 0 && !scanning && (
          <p className="text-muted-foreground text-center mt-5">
            No Chromecast devices found. Make sure your Chromecast is on the
            same network.
          </p>
        )}
      </div>
    </div>
  );
};

export default ChromecastSelector;
