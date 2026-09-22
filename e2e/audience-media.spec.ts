import { signIn } from "./helpers/auth";
import { test, expect } from "@playwright/test";

test("audience enables, tests and mutes sound without exposing host controls", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Practice a round", exact: true }).click();
  await expect(page).toHaveURL(/\/host\/[A-F0-9]{6}$/);
  const id = page.url().split("/").pop()!;
  await page.goto(`/audience/${id}`);
  await page.getByRole("button", { name: "Enable audience sound", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mute audience" })).toBeVisible();
  await page.getByRole("button", { name: "Test sound" }).click();
  await page.getByRole("button", { name: "Mute audience" }).click();
  await expect(
    page.getByRole("button", { name: "Enable audience sound", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Audience volume")).toHaveValue("0.6");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveCount(0);
});

test("Cast receiver accepts only room messages and opens the public board", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Practice a round", exact: true }).click();
  await expect(page).toHaveURL(/\/host\/[A-F0-9]{6}$/);
  const id = page.url().split("/").pop()!;
  await page.route(
    "https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `window.cast={framework:{CastReceiverContext:{getInstance:()=>({
      addCustomMessageListener:(namespace,listener)=>window.testCastMessage=listener,
      start:()=>{}
    })}}};`,
      }),
  );
  await page.goto("/cast");
  await expect(page.getByRole("heading", { name: "Ready for your game night." })).toBeVisible();
  await page.waitForFunction(() => typeof (window as any).testCastMessage === "function");
  await page.evaluate(() =>
    (window as any).testCastMessage({ data: { type: "SHOW_ROOM", room: "https://invalid/host" } }),
  );
  await expect(page.getByRole("heading", { name: "Ready for your game night." })).toBeVisible();
  await page.evaluate(
    (room) => (window as any).testCastMessage({ data: { type: "SHOW_ROOM", room } }),
    id,
  );
  await expect(page.locator(".audience-page header")).toContainText(id);
  await expect(page.getByRole("button", { name: "Fullscreen", exact: true })).toHaveCount(0);
});
