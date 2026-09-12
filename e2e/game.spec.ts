import { test, expect, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Host passphrase").fill("local-e2e-fixture-only");
  await page.getByRole("button", { name: "Enter the host desk" }).click();
  await expect(page.getByRole("button", { name: "Practice a round", exact: true })).toBeVisible();
}

test("host access rejects incorrect credentials", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Host passphrase").fill("incorrect-fixture");
  await page.getByRole("button", { name: "Enter the host desk" }).click();
  await expect(page.getByRole("alert")).toHaveText("Incorrect host passphrase.");
  await expect(page.getByRole("button", { name: "Practice a round", exact: true })).toHaveCount(0);
});

test("rehearsal buzz reaches the host and an independent audience", async ({ page, browser }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Practice a round", exact: true }).click();
  await expect(page).toHaveURL(/\/host\/[A-F0-9]{6}$/);
  const id = page.url().split("/").pop();
  const audience = await browser.newContext();
  try {
    const screen = await audience.newPage();
    await screen.goto(new URL(`/audience/${id}`, page.url()).href);
    await expect(screen.getByText(/REHEARSAL · LIVE/)).toBeVisible();
    await expect(screen.getByRole("button", { name: "Open buzzers" })).toHaveCount(0);
    await page.getByRole("button", { name: "Open buzzers", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Buzzers are open" })).toBeVisible();
    await page.getByRole("button", { name: "Simulate Ada buzzing" }).click();
    await expect(page.getByRole("heading", { name: "Ada buzzed first" })).toBeVisible();
    await expect(screen.locator(".audience-message")).toContainText("Ada");
  } finally {
    await audience.close();
  }
});

test("Fast Money rehearsal starts the real timer and enables question navigation", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("button", { name: "Practice Fast Money", exact: true }).click();
  await page.getByRole("button", { name: "Start 20-second timer" }).click();
  await expect(page.getByRole("navigation", { name: "Fast Money questions" })).toBeVisible();
  await page.getByRole("button", { name: "Question 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Question 2", exact: true })).toHaveAttribute(
    "aria-current",
    "step",
  );
});
