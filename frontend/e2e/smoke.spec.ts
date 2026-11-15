import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "./fixtures";

const SHOTS = "e2e/screenshots";
const PAGES = [
  { path: "/", name: "today", heading: "Today" },
  { path: "/mosque", name: "mosque", heading: "Mosque" },
  { path: "/speaker", name: "speaker", heading: "Speaker" },
  { path: "/adhan", name: "adhan", heading: "Adhan" },
  { path: "/settings", name: "settings", heading: "Settings" },
  { path: "/system", name: "system", heading: "System" },
];

async function setup(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-11-15T13:30:00") });
  await mockApi(page);
  return errors;
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function visit(page: Page, path: string, heading: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeAttached();
  await page.waitForLoadState("networkidle");
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`desktop ${scheme}`, () => {
    test.use({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    for (const p of PAGES) {
      test(p.name, async ({ page }) => {
        const errors = await setup(page);
        await visit(page, p.path, p.heading);
        if (p.name === "today") {
          await page.getByRole("button", { name: /year overview/i }).click();
          await expect(page.getByRole("img", { name: /prayer times across/i })).toBeVisible();
          await page.waitForTimeout(400);
        }
        if (p.name === "mosque") {
          await page.getByLabel("Search mosques").fill("fath");
          await expect(page.getByText("Mosque Al Fath")).toBeVisible();
        }
        if (p.name === "speaker") {
          await page.getByRole("button", { name: /scan for speakers/i }).click();
          await expect(page.getByText("Kitchen")).toBeVisible();
        }
        await noHorizontalScroll(page);
        await page.screenshot({ path: `${SHOTS}/desktop-${scheme}-${p.name}.png`, fullPage: true });
        expect(errors).toEqual([]);
      });
    }
  });
}

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: "dark", hasTouch: true });
  for (const p of PAGES) {
    test(p.name, async ({ page }) => {
      const errors = await setup(page);
      await visit(page, p.path, p.heading);
      await expect(page.getByRole("navigation", { name: "Main" }).and(page.locator(":visible"))).toBeVisible();
      await noHorizontalScroll(page);
      await page.screenshot({ path: `${SHOTS}/mobile-${p.name}.png`, fullPage: true });
      expect(errors).toEqual([]);
    });
  }
  test("360px has no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await setup(page);
    for (const p of PAGES) {
      await visit(page, p.path, p.heading);
      await noHorizontalScroll(page);
    }
  });
});

test("chromecast redirects to speaker", async ({ page }) => {
  await setup(page);
  await page.goto("/chromecast");
  await expect(page).toHaveURL(/\/speaker$/);
});

for (const [name, size] of [["landscape", { width: 1280, height: 800 }], ["portrait", { width: 800, height: 1280 }]] as const) {
  test(`screensaver ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    const errors = await setup(page);
    await page.goto("/screensaver");
    await expect(page.getByRole("main", { name: "Prayer clock" })).toBeVisible();
    await expect(page.getByText("Asr", { exact: true }).first()).toBeVisible();
    await noHorizontalScroll(page);
    await page.screenshot({ path: `${SHOTS}/screensaver-${name}.png` });
    expect(errors).toEqual([]);
  });
}
