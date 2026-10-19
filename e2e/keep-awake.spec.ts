import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/auth";
test("wake lock is opt-in and released when switched off", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).locks = { requests: 0, releases: 0 };
    Object.defineProperty(navigator, "wakeLock", {
      value: {
        request: async () => {
          (window as any).locks.requests++;
          return {
            addEventListener: () => {},
            release: async () => {
              (window as any).locks.releases++;
            },
          };
        },
      },
    });
  });
  await signIn(page);
  await page.getByRole("button", { name: "Practice a round", exact: true }).click();
  const toggle = page.getByLabel("Keep screen awake", { exact: true });
  await expect(toggle).not.toBeChecked();
  expect(await page.evaluate(() => (window as any).locks.requests)).toBe(0);
  await toggle.check();
  await expect(page.getByText("Screen stays awake while this page is visible.")).toBeVisible();
  await toggle.uncheck();
  expect(await page.evaluate(() => (window as any).locks.releases)).toBe(1);
});
test("unsupported wake lock gives useful guidance", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "wakeLock", { value: undefined }),
  );
  await signIn(page);
  await page.getByRole("button", { name: "Practice a round", exact: true }).click();
  await page.getByLabel("Keep screen awake", { exact: true }).check();
  await expect(page.getByText("Not supported in this browser.", { exact: false })).toBeVisible();
});
