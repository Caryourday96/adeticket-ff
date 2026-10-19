import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/auth";

test("audience projector layouts retain board, scores, QR and timer", async ({
  page,
}, testInfo) => {
  await signIn(page);
  for (const scenario of ["round", "fast"]) {
    const { id } = await (
      await page.request.post("/api/rehearsals", { data: { scenario } })
    ).json();
    await page.goto(`/audience/${id}`);
    await expect(page.locator(".stage")).toBeVisible();
    for (const [width, height] of [
      [1366, 768],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      for (const selector of [
        ".stage-scores",
        ".audience-join",
        ...(scenario === "fast" ? [".audience-timer"] : []),
      ]) {
        const box = await page.locator(selector).boundingBox();
        expect(box, selector).not.toBeNull();
        expect(box!.y + box!.height, selector).toBeLessThanOrEqual(height);
      }
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
        height,
      );
      await page.screenshot({
        path: testInfo.outputPath(`${scenario}-${width}.png`),
        fullPage: true,
      });
    }
    if (scenario === "round") {
      const state = await (await page.request.get(`/api/games/${id}/host`)).json();
      await page.request.post(`/api/games/${id}/commands`, {
        data: { id: crypto.randomUUID(), revision: state.revision, command: { type: "endGame" } },
      });
      await expect(page.locator(".winner-panel")).toContainText("No champion declared");
      await expect(page.locator(".winner-panel")).not.toContainText("YOUR CHAMPIONS");
    }
  }
});

test("small phone keeps buzzer visible and clearly ends the game", async ({
  page,
  browser,
}, testInfo) => {
  await signIn(page);
  await page.getByRole("button", { name: "Create game", exact: true }).click();
  await expect(page).toHaveURL(/host\/[A-F0-9]{6}$/);
  const id = page.url().split("/").pop()!;
  const ctx = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: { width: 320, height: 700 },
  });
  try {
    const phone = await ctx.newPage();
    await phone.goto(`/play/${id}`);
    await phone.getByLabel("Your name").fill("Player With A Longer Name");
    await phone.getByRole("button", { name: "Join game", exact: true }).click();
    await expect(phone.locator(".phone-identity")).toBeVisible();
    const registrations = await (await page.request.get(`/api/games/${id}/buzzers`)).json();
    await page.request.post(`/api/games/${id}/buzzers`, {
      data: { action: "approve", playerId: registrations.players[0].id },
    });
    await page
      .locator(".buzzer-controls > details > summary")
      .filter({ hasText: /phones/ })
      .click();
    await page
      .getByRole("button", { name: "Put Player With A Longer Name on stage", exact: true })
      .click();
    await page.getByRole("button", { name: "Open buzzers", exact: true }).click();
    await expect(phone.locator(".phone-buzzer")).toBeEnabled();
    for (const [width, height] of [
      [320, 700],
      [390, 844],
    ]) {
      await phone.setViewportSize({ width, height });
      await phone.evaluate(() => scrollTo(0, 0));
      const box = await phone.locator(".phone-buzzer").boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
      expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await phone.screenshot({ path: testInfo.outputPath(`phone-${width}.png`) });
    }
    const state = await (await page.request.get(`/api/games/${id}/host`)).json();
    await page.request.post(`/api/games/${id}/commands`, {
      data: { id: crypto.randomUUID(), revision: state.revision, command: { type: "endGame" } },
    });
    await expect(phone.locator(".phone-status")).toContainText("Game ended");
    await expect(phone.locator(".phone-buzzer")).toBeDisabled();
    await expect(phone.locator(".phone-buzzer")).toContainText("DONE");
  } finally {
    await ctx.close();
  }
});
