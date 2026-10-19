import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/auth";

test("phone continues with approved identity and teams; audience QR remains on final and new boards", async ({
  page,
  browser,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.getByLabel("Team name", { exact: true }).nth(0).fill("Party Stars");
  await page.getByRole("button", { name: "Create game", exact: true }).click();
  await expect(page).toHaveURL(/\/host\/[A-F0-9]{6}$/);
  const source = page.url().split("/").pop()!;
  const ctx = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: { width: 390, height: 844 },
  });
  try {
    const phone = await ctx.newPage();
    await phone.goto(`/play/${source}`);
    await phone.getByLabel("Your name").fill("Funke");
    await phone.getByRole("button", { name: "Join game", exact: true }).click();
    await expect(phone.locator(".phone-identity")).toContainText("Funke");
    const registrations = await (await page.request.get(`/api/games/${source}/buzzers`)).json();
    await page.request.post(`/api/games/${source}/buzzers`, {
      data: { action: "approve", playerId: registrations.players[0].id },
    });
    const audience = await ctx.newPage();
    await audience.setViewportSize({ width: 1920, height: 1080 });
    await audience.goto(`/audience/${source}`);
    await expect(audience.getByLabel("Join this game")).toContainText(source);
    const before = await (await page.request.get(`/api/games/${source}/host`)).json();
    await page.request.post(`/api/games/${source}/commands`, {
      data: { id: crypto.randomUUID(), revision: before.revision, command: { type: "endGame" } },
    });
    await expect(audience.getByLabel("Join this game")).toBeVisible();
    await audience.screenshot({ path: testInfo.outputPath("audience-desktop.png") });
    await audience.setViewportSize({ width: 390, height: 844 });
    await audience.screenshot({ path: testInfo.outputPath("audience-phone.png") });
    expect(await audience.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("link", { name: "Play again with these teams" }).click();
    await expect(page.getByLabel("Reuse teams and phones")).toHaveValue(source);
    await expect(page.getByLabel("Team name", { exact: true }).nth(0)).toHaveValue("Party Stars");
    await expect(page.getByLabel("Team name", { exact: true }).nth(0)).toBeDisabled();
    await page.getByRole("button", { name: "Create game", exact: true }).click();
    await expect(page).toHaveURL(/\/host\/[A-F0-9]{6}$/);
    const next = page.url().split("/").pop()!;
    expect(next).not.toBe(source);
    await phone.getByRole("button", { name: "Continue to next game" }).click({ timeout: 10000 });
    await expect(phone).toHaveURL(`/play/${next}`);
    await expect(phone.locator(".phone-identity")).toContainText("Party Stars");
    await expect(phone.locator(".phone-identity")).toContainText("Funke");
    await expect(phone.getByLabel("Buzzer readiness checklist")).toContainText(
      "Host approval: approved",
    );
    await expect(phone.locator(".phone-buzzer")).toBeDisabled();
    await phone.reload();
    await expect(phone.locator(".phone-identity")).toContainText("Funke");
    await audience.goto(`/audience/${next}`);
    await expect(audience.getByLabel("Join this game")).toContainText(next);
    const practice = await (
      await page.request.post("/api/rehearsals", { data: { scenario: "fast" } })
    ).json();
    await audience.goto(`/audience/${practice.id}`);
    await expect(audience.getByLabel("Join this game")).toContainText(practice.id);
  } finally {
    await ctx.close();
  }
});
