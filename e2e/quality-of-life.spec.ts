import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/auth";

test("reuse fallback and cancelled delete protect the saved game", async ({ page }) => {
  await signIn(page);
  await page.goto("/?reuse=missing");
  await expect(
    page.getByText("That saved game is unavailable for reuse.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Reuse teams and phones")).toHaveValue("");
  await page.getByRole("button", { name: "Create game", exact: true }).click();
  await expect(page).toHaveURL(/host\/[A-F0-9]{6}$/);
  const id = page.url().split("/").pop()!;
  const state = await (await page.request.get(`/api/games/${id}/host`)).json();
  await page.request.post(`/api/games/${id}/commands`, {
    data: { id: crypto.randomUUID(), revision: state.revision, command: { type: "endGame" } },
  });
  await page.goto("/");
  let warning = "";
  page.on("dialog", async (dialog) => {
    warning = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: `Delete game ${id}`, exact: true }).click();
  expect(warning).toContain("until all phones have continued");
  expect((await page.request.get(`/api/games/${id}/host`)).ok()).toBe(true);
});

test("blocked browser actions give manual recovery instructions", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    Element.prototype.requestFullscreen = async () => {
      throw new Error("denied");
    };
  });
  await signIn(page);
  await page.getByRole("button", { name: "Create game", exact: true }).click();
  await expect(page).toHaveURL(/host\/[A-F0-9]{6}$/);
  const id = page.url().split("/").pop()!;
  await page.getByText("Host diagnostics", { exact: true }).click();
  await page.getByRole("button", { name: "Copy trusted host handoff link" }).click();
  await expect(page.getByLabel("Trusted host link")).toHaveValue(new RegExp(`/host/${id}$`));
  await page.getByRole("button", { name: "Audience screen", exact: true }).click();
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not copy. Select the audience" }),
  ).toBeVisible();
  await page.goto(`/audience/${id}`);
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Fullscreen is unavailable or blocked");
});
