import { expect, it } from "vitest";
import { starterBank, fastQuestions } from "@naija/content";
import { setupSchema, type Command } from "@naija/contracts";
import { audience, createGame, transition } from "@naija/game";
import { soundCue } from "../apps/web/src/lib/sounds";
import { Store } from "../apps/server/src/store";
import { randomUUID } from "node:crypto";

function fresh() {
  return createGame(
    "ABCDEF",
    setupSchema.parse({
      teams: [
        { name: "One", members: ["A", "B"], captain: 0 },
        { name: "Two", members: ["C", "D"], captain: 0 },
      ],
      questionIds: starterBank.questions.map((q) => q.id),
    }),
    starterBank.questions,
    fastQuestions,
    starterBank.notice,
  );
}
it("plays distinct gameplay cues and keeps snapshots, repeats and undo silent", () => {
  const state = fresh(),
    before = audience(state);
  const next = audience({
    ...transition(state, { type: "buzz", team: 0 }),
    revision: 1,
    lastCommand: "buzz",
  });
  expect(soundCue(before, next)).toBe("buzz");
  expect(soundCue(null, next)).toBeNull();
  expect(soundCue(next, next)).toBeNull();
  expect(soundCue(before, { ...next, revision: 5 })).toBeNull();
  expect(soundCue(before, { ...next, lastCommand: "undo" })).toBeNull();
  expect(soundCue(before, { ...next, lastCommand: "roster" })).toBeNull();
  expect(soundCue(before, { ...next, lastCommand: "miss" })).toBe("strike");
  expect(soundCue(before, { ...next, lastCommand: "answer" })).toBe("reveal");
  expect(soundCue(before, { ...next, lastCommand: "answer", roundWinner: 0 })).toBe("win");
});
it("plays the expiry cue from the authoritative server transition", () => {
  const state = fresh();
  const running = transition(
    transition({ ...state, phase: "champion", winner: 0 }, { type: "fastStart", players: [0, 1] }),
    { type: "fastClock" },
    100,
  );
  const before = audience({ ...running, revision: 4, lastCommand: "fastClock" });
  const ended = transition(running, { type: "fastEndTurn" }, running.fast!.deadline! + 1);
  const next = audience({ ...ended, revision: 5, lastCommand: "fastEndTurn" });
  expect(soundCue(before, next)).toBe("time");
});
it("persists safe action metadata on commands and replaces it on undo", () => {
  const store = new Store(":memory:");
  try {
    const state = fresh();
    store.add(state);
    const apply = (command: Command, revision: number) =>
      store.apply(state.id, { id: randomUUID(), revision, command });
    expect(audience(apply({ type: "buzz", team: 0 }, 0)).lastCommand).toBe("buzz");
    expect(audience(apply({ type: "undo" }, 1)).lastCommand).toBe("undo");
  } finally {
    store.close();
  }
});
