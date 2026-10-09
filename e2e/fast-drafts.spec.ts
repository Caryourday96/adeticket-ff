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
  await page.getByRole("button", { name: "End turn & reveal", exact: true }).click();
  for (let i = 1; i <= 5; i++) {
    await page.getByRole("button", { name: `Reveal answer ${i} / 5`, exact: true }).click();
  }
  await page.getByRole("button", { name: "Bring in player two", exact: true }).click();
  await page.getByRole("button", { name: "Start 25-second timer", exact: true }).click();
  await expect(input).toHaveValue("");
});
