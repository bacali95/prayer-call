import { Bug } from "lucide-react";
import { Button } from "./ui/button";
import { useSearchParams } from "react-router-dom";

export function DebugToggle() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isDebugMode = searchParams.get("debug") !== null;

  const toggleDebug = () => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (isDebugMode) {
      newSearchParams.delete("debug");
    } else {
      newSearchParams.set("debug", "true");
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleDebug}
      aria-label={isDebugMode ? "Disable debug mode" : "Enable debug mode"}
      title={isDebugMode ? "Disable debug mode" : "Enable debug mode"}
      className={isDebugMode ? "bg-accent" : ""}
    >
      <Bug className="h-5 w-5" />
    </Button>
  );
}
