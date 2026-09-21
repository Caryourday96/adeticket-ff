import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Store } from "../apps/server/src/store";
import { createRehearsal } from "../apps/server/src/rehearsal";
import { reviewQuestion } from "../apps/web/src/lib/review";
import { scorecard } from "../apps/web/src/lib/scorecard";

it("records a successful steal once and removes the award on undo", () => {
  const store = new Store(":memory:");
  try {
    const state = createRehearsal("ABC123", "round");
    state.phase = "steal";
    state.control = 0;
    state.bank = 50;
    store.add(state);
    const command = {
      id: randomUUID(),
      revision: 0,
      command: { type: "answer" as const, answerId: state.questions[0].answers[1].id },
    };
    const awarded = store.apply(state.id, command);
    expect(awarded.roundResults).toEqual([
      { round: 1, prompt: state.questions[0].prompt, winner: 1, points: awarded.bank },
    ]);
    expect(awarded.scores[1]).toBe(awarded.roundResults![0].points);
    expect(store.apply(state.id, command).roundResults).toHaveLength(1);
    expect(
      store.apply(state.id, { id: randomUUID(), revision: 1, command: { type: "undo" } })
        .roundResults ?? [],
    ).toHaveLength(0);
  } finally {
    store.close();
  }
});

it("counts opened saved boards only and removes deleted game usage", () => {
  const store = new Store(":memory:");
  try {
    const state = createRehearsal("ABC123", "round");
    store.add(state);
    expect(store.questionUsage()).toEqual([]);
    store.add({ ...state, id: "REAL12", rehearsal: false });
    expect(store.questionUsage()).toEqual([
      { prompt: state.questions[0].prompt, game: "REAL12", roundType: "regular" },
    ]);
    store.remove("REAL12", 0);
    expect(store.questionUsage()).toEqual([]);
  } finally {
    store.close();
  }
});

it("keeps Fast Money history separate and counts only recorded questions once per game", () => {
  const store = new Store(":memory:");
  try {
    const state = createRehearsal("FAST12", "fast");
    state.rehearsal = false;
    const prompt = state.fastQuestions[0].prompt;
    state.fast!.entries[0][0] = { text: "Example", answerId: null, points: 0 };
    state.fast!.entries[1][0] = { text: "Different", answerId: null, points: 0 };
    store.add(state);
    expect(store.questionUsage().filter((r) => r.roundType === "fast-money")).toEqual([
      { prompt, game: state.id, roundType: "fast-money" },
    ]);
    store.remove(state.id, state.revision);
    expect(store.questionUsage()).toEqual([]);
    store.add({ ...state, id: "PRACT1", rehearsal: true });
    expect(store.questionUsage()).toEqual([]);
  } finally {
    store.close();
  }
});

it("flags repeated prompts and conflicting variants without merging distinct answers", () => {
  const question = structuredClone(createRehearsal("ABC123", "round").questions[0]);
  question.answers[1].acceptedAlternatives.push(question.answers[0].text.toUpperCase());
  const duplicate = { ...question, id: "copy", prompt: question.prompt.toUpperCase() + "!" };
  const warnings = reviewQuestion(question, [question, duplicate]);
  expect(warnings.some((warning) => warning.includes("Repeated"))).toBe(true);
  expect(warnings.some((warning) => warning.includes("more than one"))).toBe(true);
});

it("exports safe CSV and labels missing legacy round history", () => {
  const state = createRehearsal("ABC123", "fast");
  state.teams[0].name = '=HYPERLINK("bad")';
  const csv = scorecard(state);
  expect(csv).toContain("'=" + 'HYPERLINK(""bad"")');
  expect(csv).toContain("Round breakdown unavailable");
  expect(csv).not.toContain("Fast Money player");
});
