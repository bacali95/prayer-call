import { isRouteErrorResponse, useRouteError } from "react-router";
import { ErrorState } from "@/components/ui/states";

export function RouteError() {
  const error = useRouteError();
  const err = isRouteErrorResponse(error) ? new Error(`${error.status} ${error.statusText}`) : error;
  return (
    <div className="mx-auto max-w-xl p-6">
      <ErrorState error={err} title="This page failed to load" onRetry={() => window.location.reload()} />
    </div>
  );
}
