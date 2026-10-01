import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eligibleQuestions,
  questionUseCounts,
  questionKey,
} from "../packages/contracts/src/questionSelection.ts";

const questions = ["Favourite food?", "Favourite drink?", "Favourite trip?"].map((prompt, i) => ({
  id: String(i),
  prompt,
}));
const usage = [
  { prompt: " Favourite FOOD? ", game: "A", roundType: "regular" },
  { prompt: "Favourite food?", game: "A", roundType: "fast-money" },
  { prompt: "Favourite food?", game: "B", roundType: "fast-money" },
  { prompt: "Favourite drink?", game: "A", roundType: "regular" },
];
test("counts distinct games across both round types and normalized copies", () => {
  assert.equal(questionUseCounts(usage).get(questionKey(questions[0].prompt)), 2);
});
test("excludes at the exact threshold, leaves lesser-use and unused questions", () => {
  assert.deepEqual(
    eligibleQuestions(questions, usage, 2).map((q) => q.id),
    ["1", "2"],
  );
  assert.deepEqual(
    eligibleQuestions(questions, usage, 1).map((q) => q.id),
    ["2"],
  );
});
test("no limit retains all questions and deleting saved history restores eligibility", () => {
  assert.equal(eligibleQuestions(questions, usage).length, 3);
  assert.equal(
    eligibleQuestions(
      questions,
      usage.filter((row) => row.game !== "B"),
      2,
    ).length,
    3,
  );
});
test("same-prompt duplicate IDs do not create duplicate candidates", () => {
  assert.equal(
    eligibleQuestions([...questions, { id: "copy", prompt: "Favourite  food?" }], []).length,
    3,
  );
});
