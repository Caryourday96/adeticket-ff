import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/auth";

test("Fast Money drafts survive navigation and passing without recording or leaking to player two", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.getByRole("button", { name: "Practice sample Fast Money", exact: true }).click();
  await page.getByLabel("Timer duration", { exact: true }).selectOption("120");
  await page.getByRole("button", { name: "Start 120-second timer" }).click();
  const input = page.getByLabel("Off-board answer · 0 points");
  await input.fill("Unfinished first answer");
  await page.getByRole("button", { name: "Question 2", exact: true }).click();
  await expect(input).toHaveValue("");
  await input.fill("Second answer draft");
  await page.reload();
  await page.getByRole("button", { name: "Question 2", exact: true }).click();
  await expect(input).toHaveValue("Second answer draft");
  await page.getByRole("button", { name: "Pass and return later", exact: true }).click();
  await page.getByRole("button", { name: "Question 2", exact: true }).click();
  await expect(input).toHaveValue("Second answer draft");
  await expect(page.getByText("0 / 5 answers recorded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Record & next", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Question 2, recorded", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Question 1", exact: true }).click();
  await expect(input).toHaveValue("Unfinished first answer");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("1 of 5 answers recorded");
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "End turn & reveal", exact: true }).click();
  await expect(input).toHaveValue("Unfinished first answer");
  await expect(page.getByText("1 / 5 answers recorded", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "End turn & reveal", exact: true }).click();
  for (let i = 1; i <= 5; i++) {
    await page.getByRole("button", { name: `Reveal answer ${i} / 5`, exact: true }).click();
  }
  await page.getByRole("button", { name: "Bring in player two", exact: true }).click();
  await page.getByRole("button", { name: "Start 25-second timer", exact: true }).click();
  await expect(input).toHaveValue("");
});

test("Undo rotates draft scope and storage denial does not block recording", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Practice sample Fast Money", exact: true }).click();
  await page.getByLabel("Timer duration", { exact: true }).selectOption("120");
  await page.getByRole("button", { name: "Start 120-second timer" }).click();
  const input = page.getByLabel("Off-board answer · 0 points");
  await input.fill("Must not return after undo");
  const id = page.url().split("/").pop();
  const before = await (await page.request.get(`/api/games/${id}/host`)).json();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = await (await page.request.get(`/api/games/${id}/host`)).json();
  expect(paused.fast.draftScope).toBe(before.fast.draftScope);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const undone = await (await page.request.get(`/api/games/${id}/host`)).json();
  expect(undone.fast.draftScope).not.toBe(before.fast.draftScope);
  await expect(input).toHaveValue("");
  await page.reload();
  await expect(input).toHaveValue("");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("unavailable");
    };
  });
  await input.fill("Still recordable");
  await expect(page.getByText("Draft recovery is unavailable", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Record & next", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Question 1, recorded", exact: true }),
  ).toBeVisible();
});
