import React from "react";
import { Card } from "../ui/card";

type DeviceItem = {
  id: string;
  name: string;
  subtitle?: string;
};

type DeviceListProps = {
  devices: DeviceItem[];
  selectedId?: string;
  onSelect: (device: DeviceItem) => void;
  className?: string;
};

export const DeviceList: React.FC<DeviceListProps> = ({
  devices,
  selectedId,
  onSelect,
  className = "",
}) => {
  if (devices.length === 0) return null;

  return (
    <div
      className={`flex flex-col gap-2.5 max-h-[400px] overflow-y-auto ${className}`}
    >
      {devices.map((device) => (
        <Card
          key={device.id}
          className={`p-4 border cursor-pointer transition-all ${
            selectedId === device.id
              ? "bg-primary/10 border-primary"
              : "bg-card hover:bg-accent hover:border-ring"
          }`}
          onClick={() => onSelect(device)}
        >
          <div className="font-semibold mb-1 text-foreground">
            {device.name}
          </div>
          {device.subtitle && (
            <div className="text-muted-foreground text-sm">
              {device.subtitle}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};
