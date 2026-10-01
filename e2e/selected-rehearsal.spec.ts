import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/auth";

test("phone setup previews and rehearses the reserved birthday five without recording usage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page
    .getByRole("combobox", { name: "Question pack", exact: true })
    .selectOption("ihechi-birthday");
  await page.getByLabel("Use the regular question bank for Fast Money too").check();
  await page.getByRole("button", { name: "Mix Fast Money questions", exact: true }).click();
  await page.getByText("Preview the question mix", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Regular-round pool (25)", exact: true }),
  ).toBeVisible();
  const preview = page
    .locator("details")
    .filter({ has: page.getByText("Preview the question mix", { exact: true }) });
  const finalPrompts = await preview.locator("ol").nth(1).locator("li").allTextContents();
  const regularPrompts = await preview.locator("ol").nth(0).locator("li").allTextContents();
  expect(finalPrompts).toHaveLength(5);
  for (const prompt of finalPrompts)
    expect(regularPrompts.some((row) => row.includes(prompt))).toBe(false);
  const before = await (await page.request.get("/api/question-usage")).json();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .getByRole("button", { name: "Rehearse these five Fast Money questions", exact: true })
    .click();
  await expect(page).toHaveURL(/\/host\/[A-F0-9]{6}$/);
  const id = page.url().split("/").pop()!;
  const state = await (await page.request.get(`/api/games/${id}/host`)).json();
  expect(state.rehearsal).toBe(true);
  expect(state.fastQuestions.map((q: { prompt: string }) => q.prompt)).toEqual(finalPrompts);
  expect(state.phase).toBe("fast");
  expect(await (await page.request.get("/api/question-usage")).json()).toEqual(before);
  await expect(page.getByText("Fast Money practice checklist", { exact: true })).toBeVisible();
  await page.getByText(/Event readiness ·/).click();
  await expect(page.getByText("Display: needs checking", { exact: true })).toBeVisible();
  await expect(page.getByText("Audio: needs checking", { exact: true })).toBeVisible();
  await page.getByLabel("We intend to play without sound").check();
  await page.getByLabel("We are using spoken answers without phone buzzers").check();
  await expect(
    page.getByText("Audio: confirmed or intentionally silent", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Contestants: ready for the chosen method", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
