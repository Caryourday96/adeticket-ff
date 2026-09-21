import { expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { Surveys } from "../apps/server/src/surveys";
import { createApplication } from "../apps/server/src/app";
const input = {
  title: "Wedding survey",
  roundType: "regular",
  questions: Array.from({ length: 5 }, (_, i) => ({
    prompt: `Name something at a wedding number ${i + 1}`,
  })),
};

it("counts real answers, merges reviewed variants, handles skips and gates export", () => {
  const db = new DatabaseSync(":memory:");
  const surveys = new Surveys(db);
  try {
    const s = surveys.create(input);
    for (const [token, answer] of [
      ["1", "Jollof"],
      ["2", " jollof "],
      ["3", "Jollof rice"],
      ["4", "Small chops"],
    ])
      surveys.submit(s.id, token, {
        answers: Object.fromEntries(s.questions.map((q) => [q.id, answer])),
      });
    surveys.submit(s.id, "1", { answers: { q1: "Changed" } });
    surveys.submit(s.id, "5", { answers: { q1: "Beans" } });
    expect(surveys.count(s.id)).toBe(5);
    expect(surveys.results(s.id).results[0].variants[0].count).toBe(2);
    expect(() => surveys.export(s.id)).toThrow(/Close/);
    expect(() => surveys.setOpen(s.id, false, 0)).toThrow(/changed/);
    const closed = surveys.setOpen(s.id, false, surveys.get(s.id).revision);
    expect(() => surveys.submit(s.id, "6", { answers: { q1: "Rice" } })).toThrow(/closed/);
    const grouping = Object.fromEntries(
      s.questions.map((q) => [q.id, { jollof: "Jollof rice", "jollof rice": "Jollof rice" }]),
    );
    const reviewed = surveys.review(s.id, {
      revision: closed.revision,
      grouping,
      reviewed: s.questions.map((q) => q.id),
    });
    const bank = surveys.export(s.id);
    expect(bank.scoringSource).toBe("collected-survey");
    expect(bank.questions[0].answers[0]).toMatchObject({
      text: "Jollof rice",
      points: 60,
      acceptedAlternatives: ["Jollof"],
    });
    expect(bank.questions[1].answers[0].points).toBe(75);
    expect(reviewed.results[0].groups.reduce((n, g) => n + g.points, 0)).toBe(100);
    expect(reviewed.results[1].answered).toBe(4);
    surveys.setOpen(s.id, true, reviewed.revision);
    expect(surveys.get(s.id).reviewed).toEqual([]);
  } finally {
    db.close();
  }
});

it("does not leak existing answers or collected results to respondents", async () => {
  const app = createApplication({ database: ":memory:", password: "test" });
  await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(app.http.address() as { port: number }).port}/api`;
  const post = (path: string, body: unknown, cookie = "") =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });
  try {
    expect((await post("/surveys", input)).status).toBe(401);
    const login = await post("/login", { password: "test" });
    const host = login.headers.get("set-cookie")!.split(";")[0];
    const created = await post("/surveys", input, host);
    expect(created.status).toBe(201);
    const s = await created.json();
    const page = await fetch(base + `/surveys/${s.id}`);
    const phone = page.headers.get("set-cookie")!.split(";")[0];
    const publicData = await page.json();
    expect(publicData.results).toBeUndefined();
    expect(publicData.grouping).toBeUndefined();
    expect(
      (await post(`/surveys/${s.id}/responses`, { answers: { q1: "Secret survey answer" } }))
        .status,
    ).toBe(400);
    expect(
      (await post(`/surveys/${s.id}/responses`, { answers: { q1: "Secret survey answer" } }, phone))
        .status,
    ).toBe(200);
    const after = await fetch(base + `/surveys/${s.id}`, { headers: { Cookie: phone } }).then((r) =>
      r.json(),
    );
    expect(after.submitted).toBe(true);
    expect(JSON.stringify(after)).not.toContain("Secret survey answer");
    expect(
      (await fetch(base + `/surveys/${s.id}/manage`, { headers: { Cookie: phone } })).status,
    ).toBe(401);
    expect(
      (await fetch(base + `/surveys/${s.id}/export`, { headers: { Cookie: phone } })).status,
    ).toBe(401);
    expect(
      (await post(`/surveys/${s.id}/status`, { open: false, revision: 1 }, phone)).status,
    ).toBe(401);
  } finally {
    await app.close();
  }
});
