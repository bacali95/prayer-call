import React from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type SearchBoxProps = {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder?: string;
  loading?: boolean;
  searchButtonText?: string;
};

export const SearchBox: React.FC<SearchBoxProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = "Search...",
  loading = false,
  searchButtonText = "Search",
}) => {
  return (
    <div className="flex gap-2.5">
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && onSearch()}
        className="flex-1"
      />
      <Button onClick={onSearch} disabled={loading}>
        {loading ? "Searching..." : searchButtonText}
      </Button>
    </div>
  );
};
