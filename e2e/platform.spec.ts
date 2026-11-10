import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /groups.*(together|ready)/i })).toBeVisible();
}

test("assigned host reorders phones, corrects a score and replays into a private group lobby on mobile", async ({
  page,
  browser,
}, testInfo) => {
  await login(page, "owner@example.test", "synthetic-owner-password");
  const group = await page.request
    .post("/api/platform/groups", { data: { name: "Replay club" } })
    .then((r) => r.json());
  const headers = { "X-Group-Id": group.id };
  const packs = await page.request.get("/api/packs", { headers }).then((r) => r.json());
  const created = await page.request
    .post("/api/games", {
      headers,
      data: {
        teams: [
          { name: "Lagos", members: ["Ada", "Tobi"], captain: 0 },
          { name: "Abuja", members: ["Bola", "Chidi"], captain: 0 },
        ],
        questionIds: packs[0].bank.questions.map((q: any) => q.id),
      },
    })
    .then((r) => r.json());
  const root = `/api/games/${created.id}`;
  const invite = await page.request
    .post(`/api/platform/groups/${group.id}/invitations`, {
      data: { email: "replay-host@example.test", role: "host" },
    })
    .then((r) => r.json());
  const hostCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  expect(
    (
      await hostCtx.request.post("/api/platform/invitations/accept", {
        data: { token: invite.token, email: invite.email, password: "synthetic-replay-password" },
      })
    ).ok(),
  ).toBe(true);
  const session = await hostCtx.request.get("/api/session").then((r) => r.json());
  await page.request.post(`/api/platform/games/${created.id}/hosts`, {
    data: { userId: session.user.id },
  });
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phoneRegistration = await phoneCtx.request
    .post(root + "/player", { data: { team: 0, name: "Tobi" } })
    .then((r) => r.json());
  expect(
    (
      await page.request.post(root + "/buzzers", {
        data: { action: "approve", playerId: phoneRegistration.player.id },
      })
    ).ok(),
  ).toBe(true);
  const host = await hostCtx.newPage();
  await host.goto(`/host/${created.id}`); // Direct links must recover authoritative group context.
  await expect(host.getByRole("region", { name: "Game lobby" })).toBeVisible();
  await host.getByText("Team lineup & roster changes", { exact: true }).click();
  await host.getByRole("button", { name: "Edit team rosters" }).click();
  const editor = host.getByRole("dialog", { name: "Edit rosters" });
  await editor
    .locator(".team-editor")
    .first()
    .getByRole("button", { name: "Move member up" })
    .nth(1)
    .click();
  await editor.getByRole("button", { name: "Save lineup" }).click();
  await expect(editor).toHaveCount(0);
  expect(
    await phoneCtx.request
      .get(root + "/player")
      .then((r) => r.json())
      .then((v) => v.player),
  ).toMatchObject({ name: "Tobi", member: 0, approved: true, onStage: false });
  await host.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(() =>
      phoneCtx.request
        .get(root + "/player")
        .then((r) => r.json())
        .then((v) => v.player.member),
    )
    .toBe(1);
  await host
    .locator("summary")
    .filter({ hasText: /1 phones/ })
    .click();
  await host.getByRole("button", { name: "Put Tobi on stage", exact: true }).click();
  await host.getByRole("button", { name: "Start game", exact: true }).click();
  const command = async (value: any) => {
    const state = await hostCtx.request.get(root + "/host").then((r) => r.json());
    const response = await hostCtx.request.post(root + "/commands", {
      data: { id: crypto.randomUUID(), revision: state.revision, command: value },
    });
    expect(response.ok()).toBe(true);
  };
  await command({ type: "buzz", team: 0 });
  let state = await hostCtx.request.get(root + "/host").then((r) => r.json());
  await command({ type: "answer", answerId: state.questions[0].answers[0].id });
  await command({ type: "choice", pass: false });
  for (const answer of state.questions[0].answers.slice(1))
    await command({ type: "answer", answerId: answer.id });
  state = await hostCtx.request.get(root + "/host").then((r) => r.json());
  await host.getByText("Correct a team score", { exact: true }).click();
  await host.getByLabel("Points to correct").fill("10");
  await host.getByLabel("Reason for correction").fill("Synthetic host correction");
  host.once("dialog", (dialog) => dialog.accept());
  await host.getByRole("button", { name: "Apply score correction", exact: true }).click();
  await expect
    .poll(() =>
      hostCtx.request
        .get(root + "/host")
        .then((r) => r.json())
        .then((s) => s.scores[0]),
    )
    .toBe(state.scores[0] + 10);
  expect(
    JSON.stringify(await phoneCtx.request.get(root + "/audience").then((r) => r.json())),
  ).not.toContain("Synthetic host correction");
  await command({ type: "endGame" });
  const previous = await hostCtx.request.get(root + "/host").then((r) => r.json());
  host.once("dialog", (dialog) => dialog.accept());
  await host.getByRole("button", { name: "Replay with these teams", exact: true }).click();
  await expect(host.getByRole("region", { name: "Game lobby" })).toBeVisible();
  const next = new URL(host.url()).pathname.split("/").at(-1)!;
  expect(next).not.toBe(created.id);
  const nextState = await hostCtx.request.get(`/api/games/${next}/host`).then((r) => r.json());
  expect(nextState).toMatchObject({ scores: [0, 0], lobby: true, groupId: group.id });
  expect(nextState.questions).toEqual(previous.questions);
  expect((await hostCtx.request.get(root + "/host").then((r) => r.json())).scores).toEqual(
    previous.scores,
  );
  expect((await hostCtx.request.post("/api/games", { headers, data: {} })).status()).toBe(403);
  expect(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await host.screenshot({
    path: testInfo.outputPath("assigned-host-replay-mobile.png"),
    fullPage: true,
  });
  const phone = await phoneCtx.newPage();
  await phone.goto(`/play/${created.id}`);
  await phone.getByRole("button", { name: "Continue to next game" }).click();
  await expect(phone).toHaveURL(new RegExp(`/play/${next}$`));
  expect(
    await phoneCtx.request
      .get(`/api/games/${next}/player`)
      .then((r) => r.json())
      .then((v) => v.player),
  ).toMatchObject({ name: "Tobi", approved: true, onStage: false });
  await hostCtx.close();
  await phoneCtx.close();
});

test("owner invites separate admins, mobile player joins a lobby and plays remotely", async ({
  page,
  browser,
}, testInfo) => {
  await login(page, "owner@example.test", "synthetic-owner-password");
  for (const name of ["Friday Lagos", "Saturday Abuja"]) {
    await page.getByLabel("Group name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Create group", exact: true }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: testInfo.outputPath("owner-groups.png"), fullPage: true });
  const groupCard = page.locator("article.platform-group").filter({ hasText: "Friday Lagos" });
  await groupCard.getByRole("link", { name: "Open group" }).click();
  const group = new URL(page.url()).searchParams.get("group")!;
  await page.getByLabel("Email address", { exact: true }).fill("lagos-admin@example.test");
  await page.getByRole("button", { name: "Create invitation", exact: true }).click();
  await expect(page.getByLabel("Invitation link")).toBeVisible();
  const link = await page.getByLabel("Invitation link").inputValue();
  expect(link).toContain("/invite#token=");
  await expect(
    page.getByText("Creating a link does not send an email.", { exact: false }),
  ).toBeVisible();

  const adminContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const admin = await adminContext.newPage();
  await admin.goto(link);
  await admin.getByLabel("Create a password").fill("synthetic-admin-password");
  await admin.getByRole("button", { name: "Accept invitation", exact: true }).click();
  await expect(admin.getByRole("heading", { name: "Your groups, ready to play." })).toBeVisible();
  await expect(admin.getByRole("heading", { name: "Saturday Abuja" })).toHaveCount(0);
  await admin.getByRole("link", { name: "Open group" }).click();
  await expect(admin.getByRole("link", { name: "Create game", exact: true })).toBeVisible();
  const overflow = await admin.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
      .map((e) => ({ tag: e.tagName, cls: e.className, right: e.getBoundingClientRect().right })),
  );
  expect(
    await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    JSON.stringify(overflow),
  ).toBe(true);
  await admin.screenshot({ path: testInfo.outputPath("group-admin-mobile.png"), fullPage: true });
  await admin.getByRole("link", { name: "Create game", exact: true }).click();
  const create = admin.getByRole("button", { name: "Create game", exact: true });
  await expect(create).toBeEnabled();
  await create.click();
  await expect(admin.getByRole("region", { name: "Game lobby" })).toBeVisible();
  const id = new URL(admin.url()).pathname.split("/").at(-1)!;
  expect(
    await admin.evaluate(
      () => Object.keys(localStorage).filter((k) => k.startsWith("friends-showdown:host:")).length,
    ),
  ).toBe(0);

  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await phoneContext.newPage();
  await phone.goto("http://127.0.0.1:3117/play");
  await phone.getByLabel("Game code").fill(id);
  await phone.getByRole("button", { name: "Join as a player" }).click();
  await phone.getByLabel("Your name").fill("Ada phone");
  await phone.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(phone.getByRole("heading", { name: "Ada phone" })).toBeVisible();
  const root = `/api/games/${id}`;
  const second = await browser.newContext();
  const response = await second.request.post(root + "/player", {
    data: { team: 1, name: "Tobi phone" },
  });
  expect(response.ok()).toBe(true);
  const registered = await admin.request.get(root + "/buzzers").then((r) => r.json());
  for (const player of registered.players) {
    expect(
      (
        await admin.request.post(root + "/buzzers", {
          data: { action: "approve", playerId: player.id },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await admin.request.post(root + "/buzzers", {
          data: { action: "stage", playerId: player.id },
        })
      ).ok(),
    ).toBe(true);
  }
  await admin.getByRole("button", { name: "Start game", exact: true }).click();
  await expect(admin.getByRole("region", { name: "Game lobby" })).toHaveCount(0);
  await admin.getByRole("button", { name: "Open buzzers", exact: true }).click();
  const buzz = phone.getByRole("button", { name: /BUZZ TAP TO ANSWER/ });
  await expect(buzz).toBeEnabled();
  await buzz.click();
  await phone.getByLabel("Type your guess").fill("Jollof rice");
  await phone.getByRole("button", { name: "Send answer to host" }).click();
  await expect(phone.getByText("Sent to the host", { exact: true })).toBeVisible();
  await expect(
    admin.getByRole("region", { name: "Remote answers" }).getByText("Jollof rice", { exact: true }),
  ).toBeVisible();
  expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await phone.screenshot({ path: testInfo.outputPath("player-mobile.png"), fullPage: true });
  await phone.reload();
  await expect(phone.getByText("Sent to the host", { exact: true })).toBeVisible();

  const hostState = await admin.request.get(root + "/host").then((r) => r.json());
  const answer = hostState.questions[hostState.round].answers[0];
  expect(
    (
      await admin.request.post(root + "/commands", {
        data: {
          id: crypto.randomUUID(),
          revision: hostState.revision,
          command: { type: "answer", answerId: answer.id },
        },
      })
    ).ok(),
  ).toBe(true);
  await expect(
    phone
      .getByRole("region", { name: "Live game board" })
      .getByText(`${answer.text} · ${answer.points} points`),
  ).toBeVisible();
  await admin.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(admin.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect((await admin.request.get(root + "/host")).status()).toBe(401);
  await Promise.all([adminContext.close(), phoneContext.close(), second.close()]);
});

test("revocation clears private screens even when an earlier host response arrives late", async ({
  page,
  browser,
}) => {
  await login(page, "owner@example.test", "synthetic-owner-password");
  const group = await page.request
    .post("/api/platform/groups", { data: { name: "Access rehearsal" } })
    .then((r) => r.json());
  const packs = await page.request
    .get("/api/packs", { headers: { "X-Group-Id": group.id } })
    .then((r) => r.json());
  const created = await page.request
    .post("/api/games", {
      headers: { "X-Group-Id": group.id },
      data: {
        teams: [
          { name: "First", members: ["Ada"], captain: 0 },
          { name: "Second", members: ["Tobi"], captain: 0 },
        ],
        questionIds: packs[0].bank.questions.map((q: any) => q.id),
      },
    })
    .then((r) => r.json());
  const invite = await page.request
    .post(`/api/platform/groups/${group.id}/invitations`, {
      data: { email: "assigned-host@example.test", role: "host" },
    })
    .then((r) => r.json());
  const ctx = await browser.newContext();
  const acceptance = await ctx.request.post("/api/platform/invitations/accept", {
    data: { token: invite.token, email: invite.email, password: "synthetic-host-password" },
  });
  expect(acceptance.ok()).toBe(true);
  const session = await ctx.request.get("/api/session").then((r) => r.json());
  await page.request.post(`/api/platform/games/${created.id}/hosts`, {
    data: { userId: session.user.id },
  });
  const host = await ctx.newPage();
  let release!: () => void, captured!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    captured = resolve;
  });
  await host.route(`**/api/games/${created.id}/host`, async (route) => {
    const response = await route.fetch();
    captured();
    await wait;
    await route.fulfill({ response });
  });
  await host.goto(`/host/${created.id}?group=${group.id}`);
  await ready;
  await expect(host.getByRole("region", { name: "Game lobby" })).toBeVisible();
  await page.request.post(`/api/platform/games/${created.id}/hosts`, {
    data: { userId: session.user.id, remove: true },
  });
  await expect(host.getByText("Access has ended.", { exact: false })).toBeVisible();
  release();
  await expect(host.getByRole("region", { name: "Game lobby" })).toHaveCount(0);
  await expect(host.locator(".host-answer")).toHaveCount(0);
  await host.unrouteAll({ behavior: "wait" });
  await expect(host.locator(".host-answer")).toHaveCount(0);
  await ctx.close();

  const adminInvite = await page.request
    .post(`/api/platform/groups/${group.id}/invitations`, {
      data: { email: "revocable-admin@example.test", role: "admin" },
    })
    .then((r) => r.json());
  const adminCtx = await browser.newContext();
  expect(
    (
      await adminCtx.request.post("/api/platform/invitations/accept", {
        data: {
          token: adminInvite.token,
          email: adminInvite.email,
          password: "synthetic-admin-password",
        },
      })
    ).ok(),
  ).toBe(true);
  const admin = await adminCtx.newPage();
  await admin.goto(`/dashboard?group=${group.id}`);
  await expect(admin.getByRole("heading", { name: "Invite someone" })).toBeVisible();
  const adminSession = await adminCtx.request.get("/api/session").then((r) => r.json());
  await page.request.post(`/api/platform/groups/${group.id}/members`, {
    data: { userId: adminSession.user.id, role: "host" },
  });
  await admin.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(admin.getByRole("heading", { name: "Invite someone" })).toHaveCount(0);
  await expect(admin.getByRole("heading", { name: "Your assigned games" })).toBeVisible();
  await adminCtx.close();
  await page.goto("/library?group=global");
  await expect(page.locator(".error")).toHaveCount(0);
  expect(
    (await page.request.get("/api/question-usage", { headers: { "X-Group-Id": "global" } })).ok(),
  ).toBe(true);
});
