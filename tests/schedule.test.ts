import { expect, it } from "vitest";
import { starterBank, fastQuestions } from "@naija/content";
import { setupSchema } from "@naija/contracts";
import { createGame, scheduleQuestions, transition } from "@naija/game";
const questions = starterBank.questions;
const categories = [...new Set(questions.map((q) => q.category))];
it("reserves multiple categories first without repeating or losing questions", () => {
  const ordered = scheduleQuestions([...questions].reverse(), [
    { category: categories[1], count: 1 },
    { category: categories[0], count: 2 },
  ]);
  expect(ordered.slice(0, 3).map((q) => q.category)).toEqual([
    categories[1],
    categories[0],
    categories[0],
  ]);
  expect(new Set(ordered.map((q) => q.id)).size).toBe(questions.length);
  expect(ordered).toHaveLength(questions.length);
  expect(scheduleQuestions(questions)).toEqual(questions);
});
it("rejects impossible, duplicate, or excessive requirements", () => {
  expect(() => scheduleQuestions(questions, [{ category: "not a category", count: 1 }])).toThrow(
    "Not enough",
  );
  expect(() =>
    scheduleQuestions(questions, [
      { category: categories[0], count: 4 },
      { category: categories[1], count: 1 },
    ]),
  ).toThrow("four");
  expect(() =>
    scheduleQuestions(questions, [
      { category: categories[0], count: 1 },
      { category: categories[0], count: 1 },
    ]),
  ).toThrow("once");
  expect(() =>
    scheduleQuestions(questions.slice(0, 1), [{ category: questions[0].category, count: 2 }]),
  ).toThrow("Not enough");
});
function game() {
  return createGame(
    "QUOTA1",
    setupSchema.parse({
      teams: [
        { name: "One", members: ["Ada"], captain: 0 },
        { name: "Two", members: ["Chidi"], captain: 0 },
      ],
      questionIds: questions.map((q) => q.id),
      rules: { target: 100 },
      requiredGroups: [{ category: categories[0], count: 2 }],
    }),
    questions,
    fastQuestions,
    "sample",
  );
}
function settle(s: ReturnType<typeof game>) {
  s.phase = "steal";
  s.control = 0;
  s.bank = 0;
  return transition(s, { type: "miss" });
}
it("holds an early target until required rounds have actually been played", () => {
  const s = game();
  s.scores = [100, 0];
  const first = settle(s);
  expect(first.winner).toBeNull();
  expect(transition(first, { type: "next" }).phase).toBe("faceoff");
  const last = transition(first, { type: "next" });
  last.scores = [100, 150];
  expect(settle(last).winner).toBe(1);
});
it("continues a tie after required rounds and preserves old games without quotas", () => {
  const s = game();
  s.round = 1;
  s.scores = [100, 100];
  expect(settle(s).winner).toBeNull();
  delete s.minimumRounds;
  s.round = 0;
  s.scores = [100, 0];
  expect(settle(s).winner).toBe(0);
});
