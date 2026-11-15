import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "@ui-sdk/react/toast";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { success?: string; silent?: boolean };
  }
}

export function createQueryClient(opts: { retry?: number | false } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: opts.retry ?? 1, refetchOnWindowFocus: false },
    },
    mutationCache: new MutationCache({
      onSuccess: (data, _vars, _ctx, mutation) => {
        const warning = (data as { scheduling_error?: unknown } | undefined)?.scheduling_error;
        if (typeof warning === "string" && warning) {
          toast.warning("Saved, but scheduling failed", { description: warning });
          return;
        }
        const message = mutation.meta?.success;
        if (message) toast.success(message);
      },
      onError: (error, _vars, _ctx, mutation) => {
        if (!mutation.meta?.silent) toast.error(error.message || "Something went wrong");
      },
    }),
  });
}
