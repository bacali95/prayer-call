import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideProps,
} from "lucide-react";
import type { WeatherCondition } from "@/lib/types";

const ICONS: Record<WeatherCondition, [day: typeof Sun, night: typeof Sun]> = {
  clear: [Sun, Moon],
  "partly-cloudy": [CloudSun, CloudMoon],
  cloudy: [Cloud, Cloud],
  fog: [CloudFog, CloudFog],
  drizzle: [CloudDrizzle, CloudDrizzle],
  rain: [CloudRain, CloudRain],
  snow: [CloudSnow, CloudSnow],
  thunderstorm: [CloudLightning, CloudLightning],
};

export function WeatherIcon({ condition, isDay, ...props }: { condition: WeatherCondition; isDay: boolean } & LucideProps) {
  const [day, night] = ICONS[condition] ?? ICONS.cloudy;
  const Icon = isDay ? day : night;
  return <Icon aria-hidden {...props} />;
}
