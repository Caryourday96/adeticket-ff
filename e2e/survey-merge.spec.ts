import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/auth";
test("guided survey merge adds points, survives refresh, undoes and exports", async ({
  page,
  playwright,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const response = await page.request.post("/api/surveys", {
    data: {
      title: "Guided merge fixture",
      roundType: "regular",
      questions: Array.from({ length: 5 }, (_, i) => ({
        prompt: `Choose an answer for question ${i + 1}`,
      })),
    },
  });
  expect(response.ok()).toBe(true);
  const s = await response.json();
  for (let i = 1; i <= 6; i++) {
    const client = await playwright.request.newContext({ baseURL: new URL(page.url()).origin });
    try {
      const survey = await (await client.get(`/api/surveys/${s.id}`)).json();
      expect(
        (
          await client.post(`/api/surveys/${s.id}/responses`, {
            data: {
              answers: Object.fromEntries(
                survey.questions.map((q: { id: string }) => [q.id, `Answer ${i}`]),
              ),
            },
          })
        ).ok(),
      ).toBe(true);
    } finally {
      await client.dispose();
    }
  }
  await page.getByRole("link", { name: "Surveys", exact: true }).click();
  await page.getByRole("button", { name: "Manage Guided merge fixture" }).click();
  await page.getByRole("button", { name: "Close survey for review" }).click();
  async function guide() {
    await page.getByRole("button", { name: "Review one question at a time" }).click();
  }
  await guide();
  const panel = page.getByRole("region", { name: "Question review", exact: true });
  async function merge() {
    for (let i = 1; i <= 3; i++)
      await panel.getByRole("checkbox", { name: `Answer ${i} · 1 responses · 17 points` }).check();
    await panel.getByLabel("Combined answer name").fill("Combined");
    await expect(
      panel.getByText(/Merge preview: Combined — 3 responses — 51 points/),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Confirm merge" }).click();
    await expect(
      panel.getByRole("checkbox", { name: "Combined · 3 responses · 51 points" }),
    ).toBeVisible();
  }
  await merge();
  await page.reload();
  await page.getByRole("button", { name: "Manage Guided merge fixture" }).click();
  await guide();
  await expect(
    panel.getByRole("checkbox", { name: "Combined · 3 responses · 51 points" }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Undo last merge" }).click();
  await expect(
    panel.getByRole("checkbox", { name: "Answer 1 · 1 responses · 17 points" }),
  ).toBeVisible();
  await merge();
  for (let i = 1; i <= 4; i++) {
    await expect(panel.getByRole("heading", { name: `Question ${i} of 5` })).toBeVisible();
    await panel.getByRole("button", { name: "Save and next question" }).click();
  }
  await panel.getByRole("button", { name: "Save final question" }).click();
  await expect(panel.getByText(/All questions reviewed/)).toBeVisible();
  const bank = await (await page.request.get(`/api/surveys/${s.id}/export`)).json();
  expect(bank.questions[0].answers.map((a: { points: number }) => a.points)).toEqual([
    51, 17, 16, 16,
  ]);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
