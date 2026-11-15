import { Monitor, Moon, Sun } from "lucide-react";
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { useTheme, type Theme } from "@/hooks/use-theme";

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  return (
    <SegmentedControl aria-label="Theme" value={theme} onValueChange={(v) => v && setTheme(v as Theme)}>
      <SegmentedControlIndicator />
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <SegmentedControlItem key={value} value={value}>
          <Icon className="size-4" aria-hidden />
          {compact ? <span className="sr-only">{label}</span> : label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
