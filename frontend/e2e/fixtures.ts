import type { Page } from "@playwright/test";

export const config = {
  mosque: {
    uuid: "48f39ce9-6550-4aaf-916a-1e7b6329da16",
    id: "48f39ce9-6550-4aaf-916a-1e7b6329da16",
    name: "مسجد الفتح",
    address: "Sportlaan 2a 2406LD Alphen aan den Rijn, Netherlands",
  },
  chromecast: { uuid: "a5b6c311", name: "Hall speaker", model_name: "Google Nest Mini", cast_type: "audio", host: "192.168.1.20" },
  adhan_files: { fajr: "adhan-fajr.mp3", dhuhr: "adhan.mp3", asr: "adhan.mp3", maghrib: "adhan.mp3", isha: null },
  adhan_volumes: { fajr: 0.5, dhuhr: 0.6, asr: 0.6, maghrib: 0.7, isha: null },
  prayer_times: { fajr: "06:12", shuruq: "07:58", dhuhr: "12:21", asr: "14:19", maghrib: "16:38", isha: "18:12" },
  prayer_schedule_date: { gregorian: "Sunday, November 15, 2026", hijri: "" },
  unsplash_configured: true,
  weather: {
    enabled: true,
    provider: "open-meteo",
    units: "metric",
    location: { name: "Alphen aan den Rijn", latitude: 52.13, longitude: 4.66 },
  },
  weather_keys_configured: [],
};

export const weather = {
  temperature: 8.4,
  units: "metric",
  condition: "partly-cloudy",
  description: "Partly cloudy",
  is_day: true,
  provider: "open-meteo",
  location: "Alphen aan den Rijn",
  updated_at: "2026-11-15T13:30:00+00:00",
};

export const weatherProviders = [
  { id: "open-meteo", name: "Open-Meteo", needs_key: false, url: "https://open-meteo.com" },
  { id: "openweathermap", name: "OpenWeatherMap", needs_key: true, url: "https://openweathermap.org/api" },
  { id: "weatherapi", name: "WeatherAPI.com", needs_key: true, url: "https://www.weatherapi.com" },
];

export const files = [
  { name: "adhan.mp3", size: 2_480_000 },
  { name: "adhan-fajr.mp3", size: 3_120_000 },
];

export const jobs = ["fajr", "dhuhr", "asr", "maghrib"].map((p) => ({
  prayer: p,
  schedule: "0 0 * * *",
  planned_time: (config.prayer_times as Record<string, string>)[p],
  last_run: p === "fajr" ? "2026-11-15T06:12:03" : null,
  executed_today: p === "fajr",
}));

function year() {
  const data = [];
  for (let d = 1; d <= 365; d++) {
    const date = new Date(2026, 0, d);
    const s = Math.cos(((d - 172) / 365) * 2 * Math.PI); // -1 summer, 1 winter
    const t = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
    data.push({
      dayOfYear: d,
      date: date.toISOString().slice(0, 10),
      fajr: t(300 + 100 * s),
      dhuhr: t(780 + 5 * s),
      asr: t(960 - 40 * s),
      maghrib: t(1110 - 160 * s),
      isha: t(1200 - 150 * s),
      isDST: false,
      gregorian: date.toDateString(),
      hijri: "",
    });
  }
  return { year: 2026, data, dstTransitions: [] };
}

export async function mockApi(page: Page, opts: { slides?: string[] } = {}) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, "");
    const method = route.request().method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/config") return json(config);
    if (path === "/version") return json({ version: "2.0.0" });
    if (path === "/cron/jobs" && method === "GET") return json({ jobs });
    if (/^\/cron\/jobs\/[^/]+\/logs$/.test(path)) return json({ logs: "Playing adhan.mp3 on Hall speaker\nDone", prayer: "fajr" });
    if (path === "/files") return json({ files });
    if (path === "/weather/current") return json({ weather });
    if (path === "/weather/providers") return json({ providers: weatherProviders });
    if (path === "/weather/geocode")
      return json({ places: [{ name: "Alphen aan den Rijn", region: "South Holland, Netherlands", latitude: 52.13, longitude: 4.66 }] });
    if (path === "/screensaver/slides") return json({ urls: opts.slides ?? [] });
    if (path === "/mosques/search")
      return json({ mosques: [{ uuid: "a", id: "a", name: "Mosque Al Fath", address: "Alphen aan den Rijn" }, { uuid: "b", id: "b", name: "Mosquee Centrale", address: "Paris" }] });
    if (path.endsWith("/prayer-times/year")) return json(year());
    if (path.endsWith("/prayer-times")) return json(config.prayer_times);
    if (path === "/chromecasts/scan")
      return json({ devices: [{ uuid: "u1", name: "Hall speaker", model_name: "Google Nest Mini", cast_type: "audio" }, { uuid: "u2", name: "Kitchen" }] });
    return json({ error: `No mock for ${method} ${path}` }, 404);
  });
}
