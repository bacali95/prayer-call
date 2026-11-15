import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@ui-sdk/react/button";
import { Card } from "@/components/ui/card";

export function ErrorState({
  error,
  onRetry,
  title = "Something went wrong",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <Card role="alert" className="flex flex-col items-start gap-3 border-destructive/40 bg-destructive-soft p-5">
      <div className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle className="size-4" aria-hidden />
        {title}
      </div>
      <p className="text-sm text-foreground/80">{message}</p>
      {onRetry && (
        <Button data-size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden /> Try again
        </Button>
      )}
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      {icon && <div className="text-muted-foreground [&_svg]:size-8">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
