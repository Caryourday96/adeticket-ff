import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/auth";
test("host dialogs trap keyboard focus and restore trigger on phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.getByRole("button", { name: "Create game", exact: true }).click();
  await expect(page.locator(".connection")).toHaveText("Connected live");
  const trigger = page.getByRole("button", { name: "Audience screen", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Audience screen" });
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await dialog.getByLabel("Audience link").focus();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByText("Team lineup & roster changes", { exact: true }).click();
  const rosterTrigger = page.getByRole("button", { name: "Edit team rosters" });
  await rosterTrigger.click();
  const roster = page.getByRole("dialog", { name: "Edit rosters" });
  expect(await roster.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(roster).toHaveCount(0);
  await expect(rosterTrigger).toBeFocused();
});
test("offline host commands are not queued and reconnect converges with another host", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await page.getByRole("button", { name: "Create game", exact: true }).click();
  await expect(page.locator(".connection")).toHaveText("Connected live");
  const context = await browser.newContext(),
    other = await context.newPage();
  await signIn(other);
  await other.goto(page.url());
  await expect(other.locator(".connection")).toHaveText("Connected live");
  await page.context().setOffline(true);
  await expect(page.locator(".connection")).toHaveText("Reconnecting…");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("not sent or queued");
  await other.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(other.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.locator(".connection")).toHaveText("Connected live", { timeout: 15000 });
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(other.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await context.close();
});
