import { test, expect, type Page } from "@playwright/test";
import type { Command, HostState } from "@naija/contracts";
import { signIn } from "./helpers/auth";

async function hostState(page: Page, id: string): Promise<HostState> {
  const response = await page.request.get(`/api/games/${id}/host`);
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

async function hostCommand(page: Page, id: string, command: Command) {
  const { revision } = await hostState(page, id);
  const response = await page.request.post(`/api/games/${id}/commands`, {
    data: { id: crypto.randomUUID(), revision, command },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

async function rehearsal(page: Page, scenario: "round" | "fast"): Promise<string> {
  const response = await page.request.post("/api/rehearsals", { data: { scenario } });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).id;
}

test("audience rosters track the next player and keep unapproved names off screen", async ({
  page,
  browser,
}) => {
  await signIn(page);
  const id = await rehearsal(page, "round");
  const teams = (await hostState(page, id)).teams;
  const longName = "UnbrokenContestantName".repeat(4);
  teams[0].members.push(longName);
  teams[1].captain = 1;
  await hostCommand(page, id, {
    type: "roster",
    teams: [
      teams[0],
      { ...teams[1], members: ["Awaiting placeholder"], captain: 0, awaitingPlayers: true },
    ],
  });

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const audience = await context.newPage();
    await audience.goto(new URL(`/audience/${id}`, page.url()).href);
    const jollof = audience.getByRole("group", { name: teams[0].name, exact: true });
    const suya = audience.getByRole("group", { name: teams[1].name, exact: true });
    const next = audience.locator(".stage-roster-next");
    await expect(jollof.getByRole("listitem")).toHaveCount(4);
    await expect(suya).toContainText("Waiting for players");
    await expect(suya).not.toContainText("Awaiting placeholder");
    await expect(next).toHaveCount(0);

    const pending = await audience.request.post(
      new URL(`/api/games/${id}/player`, page.url()).href,
      {
        data: { team: 1, name: "Pending Signup" },
      },
    );
    expect(pending.ok(), await pending.text()).toBe(true);
    await audience.reload();
    await expect(suya).toContainText("Waiting for players");
    await expect(suya).not.toContainText("Pending Signup");
    await hostCommand(page, id, { type: "roster", teams });
    await expect(suya.getByRole("listitem")).toHaveCount(3);
    await expect(suya.getByRole("listitem").filter({ hasText: "Emeka" })).toContainText(
      "Team captain",
    );
    await expect(suya.getByRole("listitem").filter({ hasText: "Zainab" })).toContainText(
      "Face-off",
    );

    const round = await hostState(page, id);
    await hostCommand(page, id, { type: "openQuestion" });
    await expect(next).toHaveCount(0);
    await hostCommand(page, id, { type: "buzz", team: 0 });
    await expect(jollof.locator(".stage-roster-next")).toHaveText(/Ada.*Next to answer/);
    await hostCommand(page, id, {
      type: "answer",
      answerId: round.questions[round.round].answers[1].id,
    });
    await expect(suya.locator(".stage-roster-next")).toContainText("Zainab");
    await hostCommand(page, id, { type: "miss" });
    await expect(next).toHaveCount(0);
    await hostCommand(page, id, { type: "choice", pass: false });
    await expect(jollof.locator(".stage-roster-next")).toContainText("Chidi");
    await hostCommand(page, id, { type: "pause" });
    await expect(next).toHaveCount(0);
    await hostCommand(page, id, { type: "pause" });
    await expect(next).toContainText("Chidi");
    await hostCommand(page, id, { type: "miss" });
    await expect(next).toContainText("Tobi");
    await hostCommand(page, id, { type: "miss" });
    await expect(next).toContainText(longName);
    for (const [width, height] of [
      [320, 700],
      [1366, 768],
      [1920, 1080],
    ]) {
      await audience.setViewportSize({ width, height });
      await expect(next).toContainText(longName);
      expect(
        await audience.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await hostCommand(page, id, { type: "miss" });
    await expect(suya.locator(".stage-roster-next")).toContainText("Emeka");
    await hostCommand(page, id, { type: "endGame" });
    await expect(next).toHaveCount(0);
    await expect(suya.getByRole("listitem")).toHaveCount(3);
  } finally {
    await context.close();
  }
});

test("Fast Money highlights the current contestant and then the second contestant", async ({
  page,
}) => {
  await signIn(page);
  const id = await rehearsal(page, "fast");
  await page.goto(`/audience/${id}`);
  const next = page.locator(".stage-roster-next");
  await expect(next).toContainText("Ada");
  await hostCommand(page, id, { type: "fastClock" });
  await expect(next).toContainText("Ada");
  await hostCommand(page, id, { type: "fastEndTurn" });
  await expect(next).toHaveCount(0);
  for (let i = 0; i < 5; i++) await hostCommand(page, id, { type: "fastReveal" });
  await expect(next).toContainText("Chidi");
});
