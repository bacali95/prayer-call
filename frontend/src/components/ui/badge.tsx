import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  brass: "bg-brass-soft text-brass",
  success: "bg-success-soft text-success",
  danger: "bg-destructive-soft text-destructive",
} as const;

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof TONES }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
