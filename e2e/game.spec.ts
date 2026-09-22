import { signIn } from "./helpers/auth";
import { test, expect } from "@playwright/test";

test("unconfigured ads make no advertising requests on rules or player pages", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/googlesyndication|doubleclick/.test(request.url())) requests.push(request.url());
  });
  for (const path of ["/rules", "/play", "/join", "/privacy"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("status", { name: "Alpha release notice" })).toBeVisible();
    await expect(page.locator("#adsense-loader, .advertisement")).toHaveCount(0);
  }
  expect(requests).toEqual([]);
});

test("privacy page displays operator disclosure and consent management choices", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy and advertising" })).toBeVisible();
  await expect(page.locator("main")).toContainText("operated by Adeticket Inc.");
  await expect(page.locator("main")).toContainText("adeticket@gmail.com");
  const consentBtn = page.getByRole("link", { name: "Manage privacy & cookie choices" });
  await expect(consentBtn).toBeVisible();
  await consentBtn.click();
  await expect(page).toHaveURL(/\/rules#privacy-choices$/);
});

test("library review filter and completed game scorecard are available", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Question library", exact: true }).click();
  await page.getByLabel("Show questions needing review").check();
  await expect(page.getByLabel("Show questions needing review")).toBeChecked();
  await page.goto("/");
  await page.getByRole("button", { name: "Practice a round", exact: true }).click();
  await expect(page).toHaveURL(/\/host\/[A-F0-9]{6}$/);
  const gameUrl = page.url();
  const id = gameUrl.split("/").pop();
  await page.goto("/");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `End game ${id}`, exact: true }).click();
  await expect(page.getByRole("button", { name: `End game ${id}`, exact: true })).toHaveCount(0);
  await page.goto(gameUrl);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download scorecard", exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe(`naija-feud-${id}-scorecard.csv`);
});

test("question history filters recorded boards and links back to their game", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Create game", exact: true }).click();
  await expect(page).toHaveURL(/\/host\/[A-F0-9]{6}$/);
  const id = page.url().split("/").pop()!;
  const state = await (await page.request.get(`/api/games/${id}/host`)).json();
  const prompt = state.questions[0].prompt as string;
  await page.goto("/library");
  await page.getByPlaceholder("Search questions…").fill(prompt);
  await page.getByLabel("Question history", { exact: true }).selectOption("played");
  const card = page
    .locator("button.question-card")
    .filter({ has: page.getByRole("heading", { name: prompt, exact: true }) });
  await expect(card).toHaveCount(1);
  await card.click();
  await page.getByText(/Saved game history \(/).click();
  await expect(page.getByRole("link", { name: `Open game ${id}`, exact: true })).toHaveAttribute(
    "href",
    `/host/${id}`,
  );
  await page.goto("/library");
  await page.getByPlaceholder("Search questions…").fill(prompt);
  await page.getByLabel("Question history", { exact: true }).selectOption("unplayed");
  await expect(page.getByRole("heading", { name: prompt, exact: true })).toHaveCount(0);
});

test("ended-game cleanup filters rehearsals, confirms deletion and protects active games", async ({
  page,
}) => {
  await signIn(page);
  const create = async () =>
    (await (await page.request.post("/api/rehearsals", { data: { scenario: "round" } })).json())
      .id as string;
  const ended = await create();
  const active = await create();
  const state = await (await page.request.get(`/api/games/${ended}/host`)).json();
  expect(
    (
      await page.request.post(`/api/games/${ended}/commands`, {
        data: { id: crypto.randomUUID(), revision: state.revision, command: { type: "endGame" } },
      })
    ).ok(),
  ).toBeTruthy();
  const activeState = await (await page.request.get(`/api/games/${active}/host`)).json();
  expect(
    (
      await page.request.post(`/api/games/${active}/delete`, {
        data: { revision: activeState.revision, endedOnly: true },
      })
    ).status(),
  ).toBe(400);
  await page.reload();
  await page.getByLabel("Show games", { exact: true }).selectOption("ended");
  await expect(page.getByLabel(`Select ended game ${ended}`)).toBeVisible();
  await expect(page.getByLabel(`Delete game ${active}`, { exact: true })).toHaveCount(0);
  await page.getByLabel(`Select ended game ${ended}`).check();
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Delete selected ended games (1)", exact: true }).click();
  await expect(page.getByLabel(`Select ended game ${ended}`)).toBeChecked();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete selected ended games (1)", exact: true }).click();
  await expect(page.getByLabel(`Select ended game ${ended}`)).toHaveCount(0);
  await page.getByLabel("Show games", { exact: true }).selectOption("rehearsal");
  await expect(page.getByLabel(`End game ${active}`, { exact: true })).toBeVisible();
  expect((await page.request.get(`/api/games/${active}/host`)).ok()).toBeTruthy();
});

test("survey collects phone answers and exports a reviewed question bank", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Surveys", exact: true }).click();
  await page.getByLabel("Survey title").fill("Wedding survey browser test");
  await page.getByRole("button", { name: "Create survey", exact: true }).click();
  const link = await page.getByLabel("Survey share link").inputValue();
  for (const answer of ["Rice", "Beans"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const phone = await context.newPage();
      await phone.goto(link);
      for (const field of await phone.getByRole("textbox").all()) await field.fill(answer);
      await phone.getByRole("button", { name: "Submit answers", exact: true }).click();
      await expect(phone.getByRole("heading", { name: "Thank you!" })).toBeVisible();
      await phone.reload();
      await expect(phone.getByRole("heading", { name: "Thank you!" })).toBeVisible();
    } finally {
      await context.close();
    }
  }
  await page.getByRole("button", { name: "Refresh results", exact: true }).click();
  await expect(page.getByText("2 submissions · Open for responses", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close survey for review", exact: true }).click();
  for (const checkbox of await page
    .getByRole("checkbox", { name: "I reviewed this question’s answer groups" })
    .all())
    await checkbox.check();
  await page.getByRole("button", { name: "Save grouping and review", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download question bank JSON", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/survey-.*-regular\.json/);
  await page.getByRole("button", { name: "Save bank to question library", exact: true }).click();
  await expect(page.locator('[role="status"].success')).toHaveText(
    "Question bank saved in the question library.",
  );
});

test("players enter their names and only buzz on stage with saved team names", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await page.getByLabel("Team name", { exact: true }).nth(0).fill("Lagos Stars");
  await page.getByLabel("Team name", { exact: true }).nth(1).fill("Abuja Stars");
  await page.getByRole("button", { name: "Create game", exact: true }).click();
  await expect(page).toHaveURL(/\/host\/[A-F0-9]{6}$/);
  const id = page.url().split("/").pop()!;
  const context = await browser.newContext();
  try {
    const phone = await context.newPage();
    await phone.goto(new URL("/play", page.url()).href);
    await phone.getByLabel("Room code").fill(id.toLowerCase());
    await expect(phone.getByLabel("Room code")).toHaveValue(id);
    await phone.getByRole("button", { name: "Join as a player" }).click();
    await expect(phone.getByLabel("Team", { exact: true })).toContainText("Lagos Stars");
    await phone.getByLabel("Your name").fill("Funke");
    await phone.getByRole("button", { name: "Join game", exact: true }).click();
    await expect(phone.getByText("Waiting for host approval", { exact: true })).toBeVisible();
    await page.locator(".roster-summary > summary").click();
    await page.getByRole("button", { name: "Approve Funke", exact: true }).click();
    await page.getByRole("button", { name: "Open buzzers", exact: true }).click();
    await expect(phone.locator(".phone-buzzer")).toBeDisabled();
    await page.getByRole("button", { name: "Put Funke on stage", exact: true }).click();
    await page.getByRole("button", { name: "Open buzzers", exact: true }).click();
    await expect(phone.locator(".phone-buzzer")).toBeEnabled();
    await expect(page.getByLabel("Player connection panel")).toContainText("Lagos Stars · Funke");
    await expect(page.getByLabel("Player connection panel")).toContainText("Can buzz now", {
      timeout: 10000,
    });
    await phone.reload();
    await expect(phone.locator(".phone-identity")).toContainText("Lagos Stars");
    await expect(phone.locator(".phone-buzzer")).toBeEnabled();
    await page.locator(".roster-summary summary").click();
    await page.getByRole("button", { name: "Edit team rosters" }).click();
    await page.getByLabel("Team name", { exact: true }).nth(0).fill("Ibadan Stars");
    await page.getByRole("button", { name: "Save lineup", exact: true }).click();
    await expect(phone.locator(".phone-identity")).toContainText("Ibadan Stars");
    await expect(phone.locator(".phone-buzzer")).toBeDisabled();
    await page.getByRole("button", { name: "Open buzzers", exact: true }).click();
    await expect(phone.locator(".phone-buzzer")).toBeEnabled();
    await phone.locator(".phone-buzzer").click();
    await expect(page.getByRole("heading", { name: "Funke buzzed first" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("regular and Fast Money libraries stay separate through setup", async ({ page }) => {
  await signIn(page);
  await expect(page.getByLabel("Fast Money pack", { exact: true })).toHaveValue("fast-starter");
  await expect(page.getByLabel("Five Fast Money questions").locator("option:checked")).toHaveCount(
    5,
  );
  await page.getByRole("link", { name: "Question library", exact: true }).click();
  await expect(page.getByLabel("Question pack", { exact: true })).toHaveValue("starter");
  await page.getByRole("button", { name: "Fast Money", exact: true }).click();
  await expect(page.getByLabel("Question pack", { exact: true })).toHaveValue("fast-starter");
  await expect(
    page.getByLabel("Question pack", { exact: true }).locator('option[value="starter"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Regular rounds", exact: true }).click();
  await expect(page.getByLabel("Question pack", { exact: true })).toHaveValue("starter");
});

test("host access rejects incorrect credentials", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Host passphrase").fill("incorrect-fixture");
  await page.getByRole("button", { name: "Enter the host desk" }).click();
  await expect(page.getByRole("alert")).toHaveText("Incorrect host passphrase.");
  await expect(page.getByRole("button", { name: "Practice a round", exact: true })).toHaveCount(0);
});

test("rehearsal buzz reaches the host and an independent audience", async ({ page, browser }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Practice a round", exact: true }).click();
  await expect(page).toHaveURL(/\/host\/[A-F0-9]{6}$/);
  const id = page.url().split("/").pop();
  const audience = await browser.newContext();
  try {
    const screen = await audience.newPage();
    await screen.goto(new URL(`/audience/${id}`, page.url()).href);
    await expect(screen.getByText(/REHEARSAL · LIVE/)).toBeVisible();
    await expect(screen.getByRole("button", { name: "Open buzzers" })).toHaveCount(0);
    await page.getByRole("button", { name: "Open buzzers", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Buzzers are open" })).toBeVisible();
    await page.getByRole("button", { name: "Simulate Ada buzzing" }).click();
    await expect(page.getByRole("heading", { name: "Ada buzzed first" })).toBeVisible();
    await expect(screen.locator(".audience-message")).toContainText("Ada");
  } finally {
    await audience.close();
  }
});

test("Fast Money rehearsal starts the real timer and enables question navigation", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("button", { name: "Practice Fast Money", exact: true }).click();
  await page.getByLabel("Timer duration", { exact: true }).selectOption("45");
  await page.getByRole("button", { name: "Start 45-second timer" }).click();
  await expect(page.getByRole("navigation", { name: "Fast Money questions" })).toBeVisible();
  await page.getByRole("button", { name: "Question 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Question 2", exact: true })).toHaveAttribute(
    "aria-current",
    "step",
  );
});

