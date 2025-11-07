import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

type LogsModalProps = {
  prayerName: string;
  logs: string;
  onClose: () => void;
};

export const LogsModal: React.FC<LogsModalProps> = ({
  prayerName,
  logs,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <Card
        className="max-w-[80%] max-h-[80%] w-full md:w-[1000px] p-5 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="m-0">Logs for {prayerName}</h3>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded font-mono text-xs overflow-auto max-h-[500px] whitespace-pre-wrap break-words">
          {logs || "No logs available"}
        </div>
      </Card>
    </div>
  );
};
