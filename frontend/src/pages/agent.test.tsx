import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";
import AdhanPage from "@/pages/adhan-page";
import SettingsPage from "@/pages/settings-page";
import { baseConfig, baseFiles, mockFetch, renderWithProviders } from "@/test/utils";

afterEach(() => vi.unstubAllGlobals());

describe("agent readiness", () => {
  it("every ui-sdk control on the Adhan page has a name", async () => {
    mockFetch({ "GET /config": () => baseConfig, "GET /files": () => baseFiles });
    const agent = createAgent();
    renderWithProviders(<AdhanPage />);
    await screen.findByRole("combobox", { name: /Fajr adhan file/ });
    const entries = agent.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of entries) expect(e.label, `${e.component} ${e.ref} has no name`).toBeTruthy();
    const labels = entries.map((e) => e.label);
    expect(labels).toEqual(expect.arrayContaining(["Fajr adhan file", "Isha adhan file"]));
  });

  it("every ui-sdk control on the Settings page has a name", async () => {
    mockFetch({ "GET /config": () => baseConfig });
    const agent = createAgent();
    renderWithProviders(<SettingsPage />);
    await screen.findByText("Key configured");
    const entries = agent.snapshot().filter((e) => !e.offPage && e.component !== "more");
    for (const e of entries) expect(e.label, `${e.component} ${e.ref} has no name`).toBeTruthy();
  });
});
