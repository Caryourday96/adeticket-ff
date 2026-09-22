import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/auth";

test("host previews and publishes a birthday theme to a separate audience screen", async ({
  page,
  context,
}) => {
  await signIn(page);
  await page.getByRole("button", { name: "Practice a round", exact: true }).click();
  await expect(page).toHaveURL(/\/host\/[A-F0-9]{6}$/);
  const id = page.url().split("/").pop();
  const screen = await context.newPage();
  await screen.goto(`/audience/${id}`);
  await expect(screen.locator(".stage")).toBeVisible();
  await page.getByText("Audience theme & event text", { exact: true }).click();
  await page.locator("details.theme-controls select").selectOption("birthday");
  await expect(page.getByLabel("Theme preview")).toContainText("Ihechi’s Birthday Showdown");
  await expect(screen.locator(".event-brand")).toHaveCount(0);
  await page.getByRole("button", { name: "Publish to audience" }).click();
  await expect(screen.locator(".event-brand")).toContainText("Ihechi’s Birthday Showdown");
  await screen.reload();
  await expect(screen.locator(".stage")).toHaveClass(/theme-birthday/);
  await page.locator("details.theme-controls input").nth(0).fill("Ihechi & friends <party>");
  await page.getByRole("button", { name: "Publish to audience" }).click();
  await expect(screen.locator(".event-brand")).toContainText("Ihechi & friends <party>");
  await page.locator("details.theme-controls select").selectOption("classic");
  await page.getByRole("button", { name: "Publish to audience" }).click();
  await expect(screen.locator(".event-brand")).toHaveCount(0);
  await screen.close();
});
