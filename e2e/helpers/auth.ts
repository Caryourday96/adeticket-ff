import { expect, type Page, type BrowserContext } from "@playwright/test";
let cookies: Awaited<ReturnType<BrowserContext["cookies"]>> | undefined;
// Reuse a session per worker rather than exhausting the production login rate limit.
export async function signIn(page: Page) {
  if (cookies) await page.context().addCookies(cookies);
  await page.goto("/");
  if (!cookies) {
    await page.getByLabel("Host passphrase").fill("local-e2e-fixture-only");
    await page.getByRole("button", { name: "Enter the host desk" }).click();
  }
  await expect(page.getByRole("button", { name: "Practice a round", exact: true })).toBeVisible();
  cookies = await page.context().cookies();
}
