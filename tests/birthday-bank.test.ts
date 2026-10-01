import { afterAll, beforeAll, expect, it } from "vitest";
import { birthdayBank } from "@naija/content";
import { createApplication } from "../apps/server/src/app";

const server = createApplication({ database: ":memory:", password: "test-birthday-only" });
let base = "";
beforeAll(async () => {
  await new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
});
afterAll(() => server.close());

it("lets a signed-in host select the birthday bank and keeps unrevealed answers private", async () => {
  const login = await fetch(base + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "test-birthday-only" }),
  });
  expect(login.status).toBe(200);
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const packs = await (await fetch(base + "/api/packs", { headers: { Cookie: cookie } })).json();
  expect(packs.find((p: { id: string }) => p.id === "ihechi-birthday").bank).toEqual(birthdayBank);
  const response = await fetch(base + "/api/games", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      packId: "ihechi-birthday",
      teams: [
        { name: "One", members: ["A"], captain: 0 },
        { name: "Two", members: ["B"], captain: 0 },
      ],
      questionIds: birthdayBank.questions.map((q) => q.id),
    }),
  });
  expect(response.status).toBe(201);
  const { id } = await response.json();
  const audience = await (await fetch(base + `/api/games/${id}/audience`)).json();
  expect(audience.question.prompt).toBe(birthdayBank.questions[0].prompt);
  expect(audience.question.answers.every((answer: { text: unknown }) => answer.text === null)).toBe(
    true,
  );
  expect(birthdayBank.questions).toHaveLength(30);
  expect(
    birthdayBank.questions.slice(25).map((q) => q.answers.reduce((sum, a) => sum + a.points, 0)),
  ).toEqual([170, 170, 200, 200, 200]);
  expect(birthdayBank.scoringSource).toBe("illustrative");
});

it("reserves shared-bank Fast Money prompts and enforces usage and minimum pool server-side", async () => {
  const login = await fetch(base + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "test-birthday-only" }),
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const setup = {
    packId: "ihechi-birthday",
    sharedQuestionBank: true,
    teams: [
      { name: "One", members: ["A"], captain: 0 },
      { name: "Two", members: ["B"], captain: 0 },
    ],
    questionIds: birthdayBank.questions.map((q) => q.id),
    fastQuestionIds: birthdayBank.questions.slice(0, 5).map((q) => q.id),
  };
  const post = (body: unknown) =>
    fetch(base + "/api/games", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const created = await post(setup);
  expect(created.status).toBe(201);
  const { id } = await created.json();
  const state = server.store.host(id);
  expect(state.questions).toHaveLength(25);
  expect(state.fastQuestions).toHaveLength(5);
  expect(state.questions.some((q) => state.fastQuestions.some((f) => f.prompt === q.prompt))).toBe(
    false,
  );
  // Fresh server-side history must block an already-opened regular question,
  // even when the caller submits an unfiltered list or tries it in Fast Money.
  const blocked = await post({ ...setup, excludeAfterUses: 1 });
  expect(blocked.status).toBe(400);
  expect((await blocked.json()).error).toContain("excluded by usage limit");
  expect((await post({ ...setup, questionIds: setup.questionIds.slice(0, 9) })).status).toBe(400);
  expect((await post({ ...setup, excludeAfterUses: 0 })).status).toBe(400);
  expect(
    (await post({ ...setup, fastQuestionIds: setup.fastQuestionIds.slice(0, 4) })).status,
  ).toBe(400);
});
