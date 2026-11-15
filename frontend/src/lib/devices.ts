import type { CastDevice } from "@/lib/types";

/** Human-readable model line; tolerates devices that report no model or cast type. */
export function describeDevice(d: Pick<CastDevice, "model_name" | "cast_type">): string {
  const parts = [d.model_name, d.cast_type].filter((p): p is string => !!p && p !== "undefined");
  return parts.length ? parts.join(" · ") : "Cast device";
}
