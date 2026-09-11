import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createApplication } from "../apps/server/src/app";
import { starterBank, fastQuestions } from "@naija/content";
import { setupSchema } from "@naija/contracts";
import { createGame, transition } from "@naija/game";
function fresh() {
  const setup = setupSchema.parse({
    teams: [
      { name: "One", members: ["Ada", "Tobi"], captain: 0 },
      { name: "Two", members: ["Chidi", "Zee"], captain: 0 },
    ],
    questionIds: starterBank.questions.map((q) => q.id),
  });
  return createGame("RELIAB", setup, starterBank.questions, fastQuestions, "sample");
}
function fast() {
  const s = fresh();
  s.phase = "champion";
  s.winner = 0;
  return transition(
    transition(s, { type: "fastStart", players: [0, 1] }),
    { type: "fastClock" },
    1000,
  );
}
it("expires a Fast Money turn on the server without a host client", async () => {
  const server = createApplication({ database: ":memory:" });
  try {
    server.store.add(fast());
    server.expireTimers();
    expect(server.store.host("RELIAB").fast?.stage).toBe("reveal");
    expect(server.store.host("RELIAB").message).toContain("Time's up");
    const revision = server.store.host("RELIAB").revision;
    server.expireTimers();
    expect(server.store.host("RELIAB").revision).toBe(revision);
  } finally {
    await server.close();
  }
});
it("does not expire paused turns; rejects answers after the deadline", async () => {
  const server = createApplication({ database: ":memory:" });
  try {
    const s = transition(fast(), { type: "pause" }, 2000);
    server.store.add(s);
    server.expireTimers();
    expect(server.store.host(s.id).fast?.stage).toBe("running");
    expect(() =>
      transition(fast(), { type: "fastAnswer", question: 0, text: "late", answerId: null }, 22000),
    ).toThrow("Time is up");
  } finally {
    await server.close();
  }
});
it("finishes after five saved answers and rejects duplicate matches without changing entries", () => {
  let s = fast();
  for (let i = 0; i < 5; i++)
    s = transition(
      s,
      {
        type: "fastAnswer",
        question: i,
        text: fastQuestions[i].answers[0].text,
        answerId: fastQuestions[i].answers[0].id,
        finishIfComplete: true,
      },
      2000,
    );
  expect(s.fast?.stage).toBe("reveal");
  expect(s.fast?.deadline).toBeNull();
  for (let i = 0; i < 5; i++) s = transition(s, { type: "fastReveal" });
  s = transition(transition(s, { type: "fastNextPlayer" }), { type: "fastClock" }, 3000);
  expect(() =>
    transition(
      s,
      {
        type: "fastAnswer",
        question: 0,
        text: fastQuestions[0].answers[0].text,
        answerId: fastQuestions[0].answers[0].id,
        finishIfComplete: true,
      },
      4000,
    ),
  ).toThrow("Duplicate");
  expect(s.fast?.entries[1][0]).toBeNull();
});
it("tracks authenticated phone activity separately from approval and expires stale presence", async () => {
  const server = createApplication({ database: ":memory:" });
  try {
    server.store.add(fresh());
    const token = server.buzzers.join("RELIAB", 0, 0);
    const p = server.store.player("RELIAB", token)!;
    server.buzzers.control("RELIAB", "approve", p.id);
    expect(server.buzzers.host("RELIAB", 1000).players[0].connection).toBe("offline");
    expect(() => server.buzzers.heartbeat("RELIAB", "wrong", true, 1000)).toThrow("Pair");
    server.buzzers.heartbeat("RELIAB", token, true, 1000);
    expect(server.buzzers.host("RELIAB", 2000).players[0].connection).toBe("ready");
    server.buzzers.heartbeat("RELIAB", token, false, 3000);
    expect(server.buzzers.host("RELIAB", 4000).players[0].connection).toBe("away");
    expect(server.buzzers.host("RELIAB", 19000).players[0].connection).toBe("offline");
    server.buzzers.control("RELIAB", "remove", p.id);
    expect(() => server.buzzers.heartbeat("RELIAB", token, true)).toThrow("Pair");
  } finally {
    await server.close();
  }
});
