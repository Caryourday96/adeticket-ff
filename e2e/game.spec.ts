import { test, expect, type Page } from "@playwright/test";

test("library review filter and completed game scorecard are available", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Question library", exact: true }).click();
  await page.getByLabel("Show questions needing review").check();
  await expect(page.getByLabel("Show questions needing review")).toBeChecked();
  await page.goto("/");
  await page.getByRole("button", { name: "Practice a round", exact: true }).click();
  await expect(page).toHaveURL(/\/host\/[A-F0-9]{6}$/);
  const gameUrl = page.url();
  const id = gameUrl.split("/").pop();
  await page.goto("/");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `End game ${id}`, exact: true }).click();
  await expect(page.getByRole("button", { name: `End game ${id}`, exact: true })).toHaveCount(0);
  await page.goto(gameUrl);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download scorecard", exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe(`naija-feud-${id}-scorecard.csv`);
});

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Host passphrase").fill("local-e2e-fixture-only");
  await page.getByRole("button", { name: "Enter the host desk" }).click();
  await expect(page.getByRole("button", { name: "Practice a round", exact: true })).toBeVisible();
}

test("players enter their names and only buzz on stage with saved team names", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await page.getByLabel("Team name", { exact: true }).nth(0).fill("Lagos Stars");
  await page.getByLabel("Team name", { exact: true }).nth(1).fill("Abuja Stars");
  await page.getByRole("button", { name: "Create game", exact: true }).click();
  await expect(page).toHaveURL(/\/host\/[A-F0-9]{6}$/);
  const id = page.url().split("/").pop()!;
  const context = await browser.newContext();
  try {
    const phone = await context.newPage();
    await phone.goto(new URL("/play", page.url()).href);
    await phone.getByLabel("Room code").fill(id);
    await phone.getByRole("button", { name: "Join as a player" }).click();
    await expect(phone.getByLabel("Team", { exact: true })).toContainText("Lagos Stars");
    await phone.getByLabel("Your name").fill("Funke");
    await phone.getByRole("button", { name: "Join game", exact: true }).click();
    await expect(phone.getByText("Waiting for host approval", { exact: true })).toBeVisible();
    await page.locator(".buzzer-controls summary").click();
    await page.getByRole("button", { name: "Approve Funke", exact: true }).click();
    await page.getByRole("button", { name: "Open buzzers", exact: true }).click();
    await expect(phone.locator(".phone-buzzer")).toBeDisabled();
    await page.getByRole("button", { name: "Put Funke on stage", exact: true }).click();
    await page.getByRole("button", { name: "Open buzzers", exact: true }).click();
    await expect(phone.locator(".phone-buzzer")).toBeEnabled();
    await phone.reload();
    await expect(phone.locator(".phone-identity")).toContainText("Lagos Stars");
    await expect(phone.locator(".phone-buzzer")).toBeEnabled();
    await page.locator(".roster-summary summary").click();
    await page.getByRole("button", { name: "Edit team rosters" }).click();
    await page.getByLabel("Team name", { exact: true }).nth(0).fill("Ibadan Stars");
    await page.getByRole("button", { name: "Save lineup", exact: true }).click();
    await expect(phone.locator(".phone-identity")).toContainText("Ibadan Stars");
    await expect(phone.locator(".phone-buzzer")).toBeDisabled();
    await page.getByRole("button", { name: "Open buzzers", exact: true }).click();
    await expect(phone.locator(".phone-buzzer")).toBeEnabled();
    await phone.locator(".phone-buzzer").click();
    await expect(page.getByRole("heading", { name: "Funke buzzed first" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("regular and Fast Money libraries stay separate through setup", async ({ page }) => {
  await signIn(page);
  await expect(page.getByLabel("Fast Money pack", { exact: true })).toHaveValue("fast-starter");
  await expect(page.getByLabel("Five Fast Money questions").locator("option:checked")).toHaveCount(
    5,
  );
  await page.getByRole("link", { name: "Question library", exact: true }).click();
  await expect(page.getByLabel("Question pack", { exact: true })).toHaveValue("starter");
  await page.getByRole("button", { name: "Fast Money", exact: true }).click();
  await expect(page.getByLabel("Question pack", { exact: true })).toHaveValue("fast-starter");
  await expect(
    page.getByLabel("Question pack", { exact: true }).locator('option[value="starter"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Regular rounds", exact: true }).click();
  await expect(page.getByLabel("Question pack", { exact: true })).toHaveValue("starter");
});

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
  await page.getByLabel("Timer duration", { exact: true }).selectOption("45");
  await page.getByRole("button", { name: "Start 45-second timer" }).click();
  await expect(page.getByRole("navigation", { name: "Fast Money questions" })).toBeVisible();
  await page.getByRole("button", { name: "Question 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Question 2", exact: true })).toHaveAttribute(
    "aria-current",
    "step",
  );
});
