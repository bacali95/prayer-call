import React, { useState } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Alert } from "./ui/alert";
import { Config, ChromecastDevice } from "../types";
import { SelectedInfo } from "./shared/selected-info";
import { DeviceList } from "./shared/device-list";

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
    <div>
      <h2 className="text-xl font-semibold mb-3 text-foreground">
        Select Chromecast
      </h2>

      {error && (
        <Alert type="error" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <Button onClick={scanForDevices} disabled={scanning}>
          {scanning ? "Scanning..." : "Scan for Chromecast Devices"}
        </Button>

        {config?.chromecast && (
          <SelectedInfo
            title={`Selected: ${config.chromecast.name}`}
            subtitle={`Model: ${config.chromecast.model_name || "Unknown"}`}
          />
        )}

        <DeviceList
          devices={devices.map((device) => ({
            id: device.uuid,
            name: device.name,
            subtitle: `${device.model_name} • ${device.cast_type}`,
          }))}
          selectedId={config?.chromecast?.uuid}
          onSelect={(device) => {
            const chromecast = devices.find((d) => d.uuid === device.id);
            if (chromecast) selectDevice(chromecast);
          }}
        />

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
