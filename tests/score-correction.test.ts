import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  commandSchema,
  setupSchema,
  type Command,
  type GameState,
  type Phase,
} from "@naija/contracts";
import { starterBank, fastQuestions } from "@naija/content";
import { audience, createGame, transition } from "@naija/game";
import { Store } from "../apps/server/src/store";
import { scorecard } from "../apps/web/src/lib/scorecard";

function settled(): GameState {
  const state = createGame(
    "ABCDEF",
    setupSchema.parse({
      teams: [
        { name: "Jollof", members: ["Ada", "Tobi"], captain: 0 },
        { name: "Suya", members: ["Zee", "Chidi"], captain: 0 },
      ],
      questionIds: starterBank.questions.map((q) => q.id),
    }),
    starterBank.questions,
    fastQuestions,
    starterBank.notice,
  );
  return {
    ...state,
    phase: "settled",
    round: 1,
    scores: [250, 280],
    roundWinner: 1,
    bank: 280,
    revealed: state.questions[1].answers.map((answer) => answer.id),
    roundResults: [
      {
        round: 1,
        prompt: "First recorded round",
        winner: 0,
        points: 250,
        outcome: "clear",
        settledAt: 1000,
      },
      {
        round: 2,
        prompt: "Second recorded round",
        winner: 1,
        points: 280,
        outcome: "steal",
        settledAt: 2000,
      },
    ],
  };
}
const correction = (team: 0 | 1, delta: number, reason = "Host reviewed the award"): Command => ({
  type: "adjustScore",
  team,
  delta,
  reason,
});

it("allows score corrections only between completed rounds or before Fast Money starts", () => {
  for (const phase of ["faceoff", "choice", "play", "steal", "fast", "finished"] as Phase[])
    expect(() => transition({ ...settled(), phase }, correction(0, 5))).toThrow(
      "between completed rounds",
    );
  expect(() => transition({ ...settled(), lobby: true }, correction(0, 5))).toThrow(
    "Start the game",
  );
  const champion = { ...settled(), phase: "champion" as const, winner: 1 as const };
  expect(transition(settled(), correction(0, 5)).scores).toEqual([255, 280]);
  expect(transition(champion, correction(0, 5)).scores).toEqual([255, 280]);
  // Pausing between rounds is an appropriate time for a host to correct an award.
  expect(transition({ ...settled(), paused: true }, correction(0, 5)).paused).toBe(true);
  const fast = transition(champion, { type: "fastStart", players: [0, 1] });
  expect(() => transition({ ...fast, phase: "champion" }, correction(0, 5))).toThrow(
    "before Fast Money",
  );
});

it("validates integer deltas, reasons and total-score bounds without mutating rejected state", () => {
  const original = settled();
  const snapshot = structuredClone(original);
  for (const delta of [-1001, 1001, 0, 0.5, NaN, Infinity]) {
    expect(commandSchema.safeParse(correction(0, delta)).success).toBe(false);
    expect(() => transition(original, correction(0, delta))).toThrow("whole-point correction");
  }
  for (const reason of ["", "  ", "ab", "x".repeat(201)]) {
    expect(commandSchema.safeParse(correction(0, 1, reason)).success).toBe(false);
    expect(() => transition(original, correction(0, 1, reason))).toThrow("reason");
  }
  expect(() => transition(original, correction(0, -251))).toThrow("between 0 and 100000");
  expect(transition(original, correction(0, -250)).scores[0]).toBe(0);
  expect(transition({ ...original, scores: [1000, 280] }, correction(0, -1000)).scores[0]).toBe(0);
  expect(transition({ ...original, scores: [99000, 280] }, correction(0, 1000)).scores[0]).toBe(
    100000,
  );
  expect(() => transition({ ...original, scores: [100000, 280] }, correction(0, 1))).toThrow(
    "between 0 and 100000",
  );
  expect(original).toEqual(snapshot);
});

it("recalculates a winner on increases, decreases and ties while preserving the original round awards", () => {
  const state = settled(),
    originalRounds = structuredClone(state.roundResults);
  const first = transition(state, correction(0, 50, "  Manual scoring review  "), 3000);
  expect(first.scores).toEqual([300, 280]);
  expect(first.winner).toBe(0);
  expect(first.phase).toBe("settled");
  expect(first.scoreAdjustments).toEqual([
    { team: 0, delta: 50, reason: "Manual scoring review", at: 3000 },
  ]);
  const tied = transition(first, correction(1, 20), 4000);
  expect(tied.scores).toEqual([300, 300]);
  expect(tied.winner).toBeNull();
  const newWinner = transition(tied, correction(1, 25), 5000);
  expect(newWinner.winner).toBe(1);
  const belowTarget = transition({ ...newWinner, phase: "champion" }, correction(1, -50), 6000);
  expect(belowTarget.winner).toBe(0);
  expect(belowTarget.phase).toBe("champion");
  const noWinner = transition(belowTarget, correction(0, -25), 7000);
  expect(noWinner.scores).toEqual([275, 275]);
  expect(noWinner.winner).toBeNull();
  expect(noWinner.phase).toBe("settled");
  expect(noWinner.roundResults).toEqual(originalRounds);
  expect(noWinner.roundWinner).toBe(state.roundWinner);
  expect(noWinner.bank).toBe(state.bank);
  expect(noWinner.revealed).toEqual(state.revealed);
  expect(noWinner.scoreAdjustments).toHaveLength(5);
});

it("honours required minimum rounds even if corrected scores reach the target", () => {
  const state = { ...settled(), round: 0, minimumRounds: 3 };
  const early = transition(state, correction(0, 100));
  expect(early.scores[0]).toBe(350);
  expect(early.winner).toBeNull();
  const allowed = transition({ ...early, round: 2 }, correction(0, 1));
  expect(allowed.winner).toBe(0);
  const tied = transition({ ...allowed, scores: [350, 349] }, correction(1, 1));
  expect(tied.winner).toBeNull();
});

it("applies a correction once, rejects stale requests and restores totals and audit records on Undo", () => {
  const store = new Store(":memory:");
  try {
    const original = settled();
    store.add(original);
    const envelope = { id: randomUUID(), revision: 0, command: correction(0, 50) };
    const changed = store.apply(original.id, envelope);
    expect(changed.scores).toEqual([300, 280]);
    expect(changed.scoreAdjustments).toHaveLength(1);
    expect(changed.undoDescription).toContain("Correct Jollof");
    expect(changed.undoDescription).toContain("+50 points");
    expect(store.apply(original.id, envelope)).toEqual(changed);
    const saved = store.saved(original.id);
    expect(() =>
      store.apply(original.id, { id: randomUUID(), revision: 0, command: correction(1, 30) }),
    ).toThrow("game changed");
    expect(store.saved(original.id)).toEqual(saved);
    expect(() =>
      store.apply(original.id, { id: randomUUID(), revision: 1, command: correction(1, -1000) }),
    ).toThrow("between 0 and 100000");
    expect(store.saved(original.id)).toEqual(saved);
    const restored = store.apply(original.id, {
      id: randomUUID(),
      revision: 1,
      command: { type: "undo" },
    });
    expect(restored.scores).toEqual(original.scores);
    expect(restored.winner).toBe(original.winner);
    expect(restored.phase).toBe(original.phase);
    expect(restored.scoreAdjustments).toBeUndefined();
    expect(restored.roundResults).toEqual(original.roundResults);
    expect(restored.canUndo).toBe(false);
  } finally {
    store.close();
  }
});

it("keeps correction reasons private while escaping them in the explicit host CSV export", () => {
  const reason = '=HYPERLINK("https://example.test", "Private dispute note")';
  const state = transition(settled(), correction(0, 50, reason), 3000);
  const publicState = audience(state);
  expect(publicState).not.toHaveProperty("scoreAdjustments");
  expect(JSON.stringify(publicState)).not.toContain("Private dispute note");
  expect(publicState.scores).toEqual([300, 280]);
  const csv = scorecard(state);
  expect(csv).toContain('"Score correction team","Points","Reason","At (UTC)"');
  expect(csv).toContain('"\'=HYPERLINK(""https://example.test"", ""Private dispute note"")"');
  expect(csv).toContain('"Jollof","50"');
  expect(csv).not.toContain("Round breakdown unavailable");
  expect(csv).toContain("First recorded round");
});
