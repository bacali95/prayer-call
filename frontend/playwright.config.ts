import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.results",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI downloads the build artifact into build/, so it skips the rebuild.
    command: process.env.PLAYWRIGHT_SKIP_BUILD
      ? "bun run preview --strictPort"
      : "bun run build && bun run preview --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
