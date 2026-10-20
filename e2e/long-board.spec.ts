import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/auth";

test("long custom board text wraps without clipping answers, names or points", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const prompt =
    "Name something friends might bring when they are invited to a birthday celebration and want to make the evening memorable. "
      .repeat(2)
      .trim();
  const bank = {
    schemaVersion: 1,
    title: "Local long-text layout fixture",
    roundType: "regular",
    scoringSource: "illustrative",
    notice: "Synthetic layout fixture only.",
    questions: Array.from({ length: 5 }, (_, i) => ({
      id: `long-${i}`,
      category: "party",
      prompt: `${prompt} ${i + 1}`,
      answers: Array.from({ length: 8 }, (_, j) => ({
        id: `answer-${j}`,
        text:
          j === 0
            ? "LongUnbrokenAnswer".repeat(5)
            : "A thoughtful present chosen especially for the birthday guest and their friends",
        points: 30 - j,
      })),
    })),
  };
  const packResponse = await page.request.post("/api/packs", { data: bank });
  expect(packResponse.status()).toBe(201);
  const pack = await packResponse.json();
  const create = await page.request.post("/api/games", {
    data: {
      packId: pack.id,
      questionIds: bank.questions.map((q) => q.id),
      teams: [
        { name: "BirthdayCelebrationTeam".repeat(4), members: ["Guest"], captain: 0 },
        {
          name: "A wonderful team of friends celebrating together",
          members: ["Other guest"],
          captain: 0,
        },
      ],
    },
  });
  expect(create.status(), await create.text()).toBe(201);
  const { id } = await create.json();
  for (const command of [
    { type: "openQuestion" },
    { type: "buzz", team: 0 },
    { type: "answer", answerId: "answer-0" },
    { type: "choice", pass: false },
    ...Array.from({ length: 7 }, (_, i) => ({ type: "answer", answerId: `answer-${i + 1}` })),
  ]) {
    const state = await (await page.request.get(`/api/games/${id}/host`)).json();
    const response = await page.request.post(`/api/games/${id}/commands`, {
      data: { id: crypto.randomUUID(), revision: state.revision, command },
    });
    expect(response.ok(), await response.text()).toBe(true);
  }
  await page.goto(`/audience/${id}`);
  await expect(page.locator(".answer-tile.revealed")).toHaveCount(8);
  for (const [width, height] of [
    [1366, 768],
    [1920, 1080],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    const overflow = await page
      .locator(".question-plaque h2, .answer-tile, .answer-tile > span, .stage-team")
      .evaluateAll((elements) =>
        elements
          .filter(
            (el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
          )
          .map((el) => ({
            tag: el.className,
            text: el.textContent?.slice(0, 35),
            width: el.clientWidth,
            scroll: el.scrollWidth,
          })),
      );
    expect(overflow, `${width}px clipped content`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: testInfo.outputPath(`long-board-${width}.png`), fullPage: true });
  }
});
