import { expect, test, type Page } from "@playwright/test";
import { config, mockApi } from "./fixtures";

// ui-sdk's web.css doesn't hide a toast's per-type icons; index.css must, or every
// toast shows the check and the cross together.
async function saveKey(page: Page) {
  await page.getByLabel("Replace Unsplash access key").fill("new-key");
  await page.getByRole("button", { name: "Replace key" }).click();
}

async function expectOnlyIcon(page: Page, type: "success" | "warning" | "error") {
  const toast = page.locator(`[data-slot="toast"][data-type="${type}"]`).last();
  await expect(toast).toBeVisible();
  const visibleIcons = toast.locator(":scope > [data-show]:visible");
  await expect(visibleIcons).toHaveCount(1);
  await expect(visibleIcons).toHaveAttribute("data-show", type);
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto("/settings");
});

test("success toast shows only the check icon", async ({ page }) => {
  await saveKey(page);
  await expectOnlyIcon(page, "success");
});

test("warning toast shows only the warning icon", async ({ page }) => {
  await page.route("**/api/config", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ json: { ...config, scheduling_error: "crontab unavailable" } })
      : route.fallback(),
  );
  await saveKey(page);
  await expectOnlyIcon(page, "warning");
});

test("error toast shows only the cross icon", async ({ page }) => {
  await page.route("**/api/config", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: { error: "boom" } })
      : route.fallback(),
  );
  await saveKey(page);
  await expectOnlyIcon(page, "error");
});
