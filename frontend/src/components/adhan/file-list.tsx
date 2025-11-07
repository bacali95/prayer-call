import React from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { FileInfo } from "../../types";

type FileListProps = {
  files: FileInfo[];
  onTestPlay: (filename: string) => void;
  onDelete: (filename: string) => void;
  canTestPlay?: boolean;
};

export const FileList: React.FC<FileListProps> = ({
  files,
  onTestPlay,
  onDelete,
  canTestPlay = false,
}) => {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="mb-3">Uploaded Files</h3>
      {files.map((file) => (
        <Card key={file.name} className="flex justify-between items-center p-3">
          <div>
            <strong>{file.name}</strong>
            <span className="text-muted-foreground ml-2.5">
              ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          </div>
          <div className="flex gap-2.5">
            <Button
              size="sm"
              onClick={() => onTestPlay(file.name)}
              disabled={!canTestPlay}
            >
              Test Play
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(file.name)}
            >
              Delete
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};
