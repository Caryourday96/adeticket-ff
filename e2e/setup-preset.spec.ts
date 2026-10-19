import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/auth";
test("saved setup is opt-in, reloadable and removable without creating a game", async ({
  page,
}) => {
  await signIn(page);
  await page.getByText("Saved setup preset", { exact: true }).click();
  await page.getByLabel("Team name", { exact: true }).first().fill("Evening Stars");
  await page.getByLabel("Preset name", { exact: true }).fill("Friday game");
  await page.getByRole("button", { name: "Save setup", exact: true }).click();
  await expect(page.getByText("Saved Friday game on this device.")).toBeVisible();
  await page.reload();
  await page.getByText("Saved setup preset", { exact: true }).click();
  await page.getByRole("button", { name: "Load saved setup", exact: true }).click();
  await expect(page.getByLabel("Team name", { exact: true }).first()).toHaveValue("Evening Stars");
  await expect(page).not.toHaveURL(/\/host\//);
  await page.getByRole("button", { name: "Clear saved setup", exact: true }).click();
  await page.getByRole("button", { name: "Load saved setup", exact: true }).click();
  await expect(page.getByText("No setup preset saved on this device yet.")).toBeVisible();
});
