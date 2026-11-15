import type { Weather } from "@/lib/types";

export function formatTemperature(w: Pick<Weather, "temperature" | "units">): string {
  return `${Math.round(w.temperature)}°${w.units === "imperial" ? "F" : "C"}`;
}
