import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "../contexts/theme-context";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getIcon = () => {
    if (theme === "system") {
      return <Monitor className="h-5 w-5" />;
    }
    return resolvedTheme === "dark" ? (
      <Moon className="h-5 w-5" />
    ) : (
      <Sun className="h-5 w-5" />
    );
  };

  const getLabel = () => {
    if (theme === "system") {
      return "System theme";
    }
    return theme === "dark" ? "Dark mode" : "Light mode";
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      aria-label={getLabel()}
      title={getLabel()}
      className="relative"
    >
      {getIcon()}
    </Button>
  );
}
