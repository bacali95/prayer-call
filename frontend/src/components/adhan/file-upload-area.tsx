import React from "react";

type FileUploadAreaProps = {
  onFileSelect: (file: File) => void;
  uploading?: boolean;
  accept?: string;
};

export const FileUploadArea: React.FC<FileUploadAreaProps> = ({
  onFileSelect,
  uploading = false,
  accept = ".mp3,audio/mpeg",
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      e.target.value = ""; // Reset input
    }
  };

  return (
    <label className="border-2 border-dashed border-border rounded p-5 text-center cursor-pointer transition-all bg-muted/30 hover:border-primary hover:bg-accent">
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
      />
      {uploading ? "Uploading..." : "Click to upload MP3 file"}
    </label>
  );
};
