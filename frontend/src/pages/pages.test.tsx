import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TodayPage from "@/pages/today-page";
import AdhanPage from "@/pages/adhan-page";
import SettingsPage from "@/pages/settings-page";
import SpeakerPage from "@/pages/speaker-page";
import SystemPage from "@/pages/system-page";
import { baseConfig, baseFiles, fail, mockFetch, renderWithProviders } from "@/test/utils";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const jobs = {
  jobs: [
    { prayer: "asr", schedule: "19 14 * * *", planned_time: "14:19", last_run: null, executed_today: false },
    { prayer: "reschedule", schedule: "0 2 * * *", planned_time: "02:00", last_run: null },
  ],
};

describe("Today", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T13:30:00"));
  });

  it("shows the next prayer, countdown and the timeline with shuruq muted", async () => {
    mockFetch({
      "GET /config": () => baseConfig,
      "GET /cron/jobs": () => jobs,
      "GET /files": () => baseFiles,
    });
    renderWithProviders(<TodayPage />);

    const hero = await screen.findByRole("region", { name: "Next prayer" });
    expect(within(hero).getByRole("heading", { name: "Asr" })).toBeInTheDocument();
    expect(within(hero).getByText("العصر")).toHaveAttribute("lang", "ar");
    expect(within(hero).getByRole("timer")).toHaveTextContent("00:49:00");

    const list = screen.getByRole("list", { name: "Today's prayer times" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(6);
    expect(rows[3]).toHaveAttribute("aria-current", "time");
    // shuruq: no edit control
    expect(within(rows[1]).queryByRole("button")).toBeNull();
    expect(within(rows[3]).getByText("Scheduled 14:19")).toBeInTheDocument();
    expect(within(rows[0]).getByText("adhan-fajr.mp3", { exact: false })).toBeInTheDocument();
  });

  it("prompts to finish setup when nothing is configured", async () => {
    mockFetch({ "GET /config": () => ({ unsplash_configured: false }), "GET /cron/jobs": () => jobs, "GET /files": () => baseFiles });
    renderWithProviders(<TodayPage />);
    expect(await screen.findByText("No prayer times yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Choose your mosque/ })).toHaveAttribute("href", "/mosque");
  });

  it("shows an error state with the backend message", async () => {
    mockFetch({ "GET /config": () => fail(500, "disk is full") });
    renderWithProviders(<TodayPage />);
    expect(await screen.findByText("disk is full")).toBeInTheDocument();
  });
});

describe("Adhan", () => {
  it("sends a partial update with only the changed file", async () => {
    const calls = mockFetch({
      "GET /config": () => baseConfig,
      "GET /files": () => baseFiles,
      "POST /config": () => baseConfig,
    });
    const user = userEvent.setup();
    renderWithProviders(<AdhanPage />);

    const fajr = await screen.findByRole("combobox", { name: /Fajr adhan file/ });
    await user.click(fajr);
    await user.click(await screen.findByRole("option", { name: "adhan.mp3" }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST" && c.path === "/config")!;
    expect(post.body).toEqual({ adhan_files: { fajr: "adhan.mp3" } });
  });

  it("sends only the changed volume key, debounced", async () => {
    const calls = mockFetch({
      "GET /config": () => baseConfig,
      "GET /files": () => baseFiles,
      "POST /config": () => baseConfig,
    });
    renderWithProviders(<AdhanPage />);
    const slider = await screen.findByRole("slider", { name: "Dhuhr volume" });
    fireEvent.change(slider, { target: { value: "0.8" } });
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true), { timeout: 2000 });
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ adhan_volumes: { dhuhr: 0.8 } });
  });

  it("asks in-app before deleting, warns when assigned, and encodes the filename", async () => {
    const calls = mockFetch({
      "GET /config": () => baseConfig,
      "GET /files": () => ({ files: [{ name: "adhan fajr.mp3", size: 10 }] }),
      "DELETE /files/adhan%20fajr.mp3": () => ({ deleted: "adhan fajr.mp3", unassigned: ["fajr"] }),
    });
    const confirmSpy = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    renderWithProviders(<AdhanPage />);

    await user.click(await screen.findByRole("button", { name: "Delete adhan fajr.mp3" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("adhan fajr.mp3");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);

    await user.click(within(dialog).getByRole("button", { name: "Delete forever" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
    expect(await screen.findByText(/Fajr now has no adhan/)).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("marks the destructive confirm button for agents", async () => {
    mockFetch({ "GET /config": () => ({ ...baseConfig, adhan_files: { fajr: "a.mp3" } }), "GET /files": () => ({ files: [{ name: "a.mp3", size: 1 }] }) });
    const user = userEvent.setup();
    renderWithProviders(<AdhanPage />);
    await user.click(await screen.findByRole("button", { name: "Delete a.mp3" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/currently assigned to\s*Fajr/);
    expect(within(dialog).getByRole("button", { name: "Delete forever" })).toHaveAttribute("data-agent-confirm");
  });
});

describe("Settings", () => {
  it("never displays the Unsplash key, only a configured badge", async () => {
    mockFetch({ "GET /config": () => ({ ...baseConfig, unsplash_access_key: "SECRET-KEY-123", unsplash_configured: true }) });
    const { container } = renderWithProviders(<SettingsPage />);
    expect(await screen.findByText("Key configured")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("SECRET-KEY-123");
    const input = screen.getByLabelText(/Replace Unsplash access key/);
    expect(input).toHaveValue("");
    expect(input.closest("[data-agent-secret]")).not.toBeNull();
  });

  it("replaces and clears the key through the API", async () => {
    const calls = mockFetch({
      "GET /config": () => baseConfig,
      "POST /config": () => baseConfig,
      "GET /cron/jobs": () => jobs,
    });
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await user.type(await screen.findByLabelText(/Replace Unsplash access key/), "new-key");
    await user.click(screen.getByRole("button", { name: "Replace key" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(1));
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ unsplash_access_key: "new-key" });

    await user.click(screen.getByRole("button", { name: /Clear key/ }));
    await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(2));
    expect(calls.filter((c) => c.method === "POST")[1].body).toEqual({ unsplash_access_key: "" });
  });

  it("shows a warning toast when scheduling failed, not a success toast", async () => {
    mockFetch({
      "GET /config": () => baseConfig,
      "POST /config": () => ({ ...baseConfig, scheduling_error: "crontab not writable" }),
      "GET /cron/jobs": () => jobs,
    });
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await user.type(await screen.findByLabelText(/Replace Unsplash access key/), "k");
    await user.click(screen.getByRole("button", { name: "Replace key" }));
    expect(await screen.findByText("crontab not writable")).toBeInTheDocument();
    expect(screen.queryByText("Unsplash key saved")).toBeNull();
  });
});

describe("Settings weather", () => {
  const providers = {
    providers: [
      { id: "open-meteo", name: "Open-Meteo", needs_key: false, url: "https://open-meteo.com" },
      { id: "weatherapi", name: "WeatherAPI.com", needs_key: true, url: "https://www.weatherapi.com" },
    ],
  };
  const location = { name: "Alphen aan den Rijn", latitude: 52.13, longitude: 4.66 };

  it("turns weather on and picks a location from the search", async () => {
    const calls = mockFetch({
      "GET /config": () => baseConfig,
      "POST /config": () => baseConfig,
      "GET /weather/providers": () => providers,
      "GET /weather/geocode": () => ({ places: [{ ...location, region: "South Holland, Netherlands" }] }),
    });
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    await user.click(await screen.findByRole("switch", { name: /Show weather/ }));
    await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(1));
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ weather: { enabled: true } });

    await user.type(screen.getByRole("searchbox", { name: "Location" }), "alphen");
    await user.click(await screen.findByRole("button", { name: "Use Alphen aan den Rijn, South Holland, Netherlands" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(2));
    expect(calls.filter((c) => c.method === "POST")[1].body).toEqual({ weather: { location } });
  });

  it("asks for a key for providers that need one and shows the live reading", async () => {
    const config = {
      ...baseConfig,
      weather: { enabled: true, provider: "weatherapi", units: "metric", location },
      weather_keys_configured: [],
    };
    const calls = mockFetch({
      "GET /config": () => config,
      "POST /config": () => ({ ...config, weather_keys_configured: ["weatherapi"] }),
      "GET /weather/providers": () => providers,
      "GET /weather/current": () => ({
        weather: { temperature: 7.6, units: "metric", condition: "rain", description: "Light rain", is_day: true, provider: "weatherapi", location: "Alphen aan den Rijn", updated_at: "" },
      }),
    });
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    expect(await screen.findByText("Key needed")).toBeInTheDocument();
    expect(calls.some((c) => c.path === "/weather/current")).toBe(false);
    await user.type(screen.getByLabelText("WeatherAPI.com API key"), "wa-key");
    await user.click(screen.getAllByRole("button", { name: "Save key" })[0]);
    await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(1));
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ weather_api_keys: { weatherapi: "wa-key" } });
    expect(await screen.findByText("8°C")).toBeInTheDocument();
    expect(screen.getByText("Light rain in Alphen aan den Rijn")).toBeInTheDocument();
  });
});

describe("Speaker", () => {
  it("handles devices without model or cast type", async () => {
    mockFetch({
      "GET /config": () => ({}),
      "GET /chromecasts/scan?timeout=10": () => ({ devices: [{ uuid: "u1", name: "Kitchen" }] }),
    });
    const user = userEvent.setup();
    renderWithProviders(<SpeakerPage />);
    await user.click(await screen.findByRole("button", { name: /Scan for speakers/ }));
    expect(await screen.findByText("Kitchen")).toBeInTheDocument();
    expect(screen.getByText("Cast device")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("selects a device with a config update and toasts backend errors", async () => {
    const calls = mockFetch({
      "GET /config": () => ({}),
      "GET /chromecasts/scan?timeout=10": () => ({ devices: [{ uuid: "u1", name: "Kitchen", model_name: "Nest" }] }),
      "POST /config": () => fail(400, "chromecast is invalid"),
    });
    const user = userEvent.setup();
    renderWithProviders(<SpeakerPage />);
    await user.click(await screen.findByRole("button", { name: /Scan for speakers/ }));
    await user.click(await screen.findByRole("button", { name: "Use Kitchen" }));
    expect(await screen.findByText("chromecast is invalid")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")!.body).toMatchObject({ chromecast: { uuid: "u1" } });
  });
});

describe("System", () => {
  it("does not offer delete for the reschedule job but still shows its logs", async () => {
    const calls = mockFetch({
      "GET /cron/jobs": () => jobs,
      "GET /version": () => ({ version: "2.0.0" }),
      "GET /cron/jobs/reschedule/logs": () => ({ logs: "rescheduled ok", prayer: "reschedule" }),
    });
    const user = userEvent.setup();
    renderWithProviders(<SystemPage />);
    const list = (await screen.findAllByRole("button", { name: /Logs/ }))[0].closest("ul")!;
    const items = within(list).getAllByRole("listitem");
    expect(within(items[0]).getByRole("button", { name: /Delete/ })).toBeInTheDocument();
    expect(within(items[1]).queryByRole("button", { name: /Delete/ })).toBeNull();
    await user.click(within(items[1]).getByRole("button", { name: /Logs/ }));
    expect(await screen.findByText("rescheduled ok")).toBeInTheDocument();
    expect(calls.some((c) => c.path === "/cron/jobs/reschedule/logs")).toBe(true);
    expect(await screen.findByText("2.0.0")).toBeInTheDocument();
  });
});
