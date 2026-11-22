import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { Surveys } from "../apps/server/src/surveys";
import { groupSurveyVariants, playableSurveyGroups } from "@naija/contracts";

it("combines legacy ballots and optional second choices without counting extra respondents", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const surveys = new Surveys(db);
    const survey = surveys.create({
      title: "Ranked survey",
      roundType: "regular",
      questions: Array.from({ length: 5 }, (_, index) => ({
        prompt: `Favorite item ${index + 1}`,
      })),
    });
    const answerEveryQuestion = (answer: string) =>
      Object.fromEntries(survey.questions.map((question) => [question.id, answer]));
    surveys.submit(survey.id, "one", { answers: answerEveryQuestion("Rice") });
    expect(() =>
      surveys.submit(survey.id, "invalid", {
        answers: { q1: "Rice" },
        secondAnswers: { q2: "Beans" },
      }),
    ).toThrow(/first answer before a second/);
    expect(() =>
      surveys.submit(survey.id, "invalid", {
        answers: { q1: "Rice" },
        secondAnswers: { q1: " ＲＩＣＥ " },
      }),
    ).toThrow(/different second answer/);
    expect(() =>
      surveys.submit(survey.id, "invalid", {
        answers: { q1: "Rice" },
        secondAnswers: { q99: "Beans" },
      }),
    ).toThrow(/Unknown survey question/);
    surveys.submit(survey.id, "two", {
      answers: answerEveryQuestion("Beans"),
      secondAnswers: answerEveryQuestion("Beans & peas"),
    });
    const closed = surveys.setOpen(survey.id, false, surveys.get(survey.id).revision);
    expect(closed.responseCount).toBe(2);
    expect(closed.results[0].answered).toBe(2);
    expect(closed.results[0].variants).toContainEqual({
      key: "beans & peas",
      text: "Beans & peas",
      count: 1,
      secondChoices: 1,
    });
    const reviewed = surveys.review(survey.id, {
      revision: closed.revision,
      grouping: Object.fromEntries(
        survey.questions.map((question) => [question.id, { "beans & peas": "Beans" }]),
      ),
      reviewed: survey.questions.map((question) => question.id),
    });
    expect(reviewed.results[0].groups[0]).toMatchObject({
      text: "Beans",
      count: 2,
      secondChoices: 1,
      points: 60,
    });
    const exported = new Surveys(db).export(survey.id).questions[0];
    expect(exported.answers.map(({ text, points }) => ({ text, points }))).toEqual([
      { text: "Beans", points: 60 },
      { text: "Rice", points: 40 },
    ]);
    expect(exported.hostNotes).toContain("2 nonblank responses");
    expect(exported.hostNotes).toContain("cover 3 of 3 choices");
  } finally {
    db.close();
  }
});

it("prefers first choices when the total voting weight is tied", () => {
  const board = playableSurveyGroups([
    { text: "Alphabetically first", count: 2, secondChoices: 2 },
    { text: "Preferred first choice", count: 1 },
  ]);
  expect(board.map(({ text, points }) => ({ text, points }))).toEqual([
    { text: "Preferred first choice", points: 50 },
    { text: "Alphabetically first", points: 50 },
  ]);
});

it.each([
  {
    name: "retains a rare answer that rounds to zero before export",
    counts: [200, 1],
    expected: [99, 1],
  },
  {
    name: "keeps the original rounding when all answers fit",
    counts: [3, 2, 1],
    expected: [50, 33, 17],
  },
  {
    name: "rounds the eight displayed answers to 100 when a group is omitted",
    counts: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    expected: [13, 13, 13, 13, 12, 12, 12, 12],
  },
  {
    name: "preserves one point for each retained answer in a skewed survey",
    counts: [102, 11, 9, 8, 4, 4, 1, 1, 1],
    expected: [72, 8, 6, 6, 3, 3, 1, 1],
  },
])("$name", ({ counts, expected }) => {
  const db = new DatabaseSync(":memory:");
  try {
    const surveys = new Surveys(db);
    const survey = surveys.create({
      title: "Board scoring survey",
      roundType: "regular",
      questions: Array.from({ length: 5 }, (_, index) => ({
        prompt: `Question about a favorite item ${index + 1}`,
      })),
    });
    for (const [index, count] of counts.entries()) {
      for (let vote = 0; vote < count; vote++) {
        surveys.submit(survey.id, `${index}-${vote}`, {
          answers: Object.fromEntries(
            survey.questions.map((question) => [question.id, `Answer ${index + 1}`]),
          ),
        });
      }
    }
    const closed = surveys.setOpen(survey.id, false, surveys.get(survey.id).revision);
    expect(() => surveys.export(survey.id)).toThrow("review every question");
    const reviewed = surveys.review(survey.id, {
      revision: closed.revision,
      grouping: {},
      reviewed: survey.questions.map((question) => question.id),
    });
    const total = counts.reduce((sum, count) => sum + count, 0);
    const shown = counts.slice(0, expected.length).reduce((sum, count) => sum + count, 0);
    for (const result of reviewed.results) {
      expect(result.groups.map((group) => group.count)).toEqual(counts);
      expect(result.groups.reduce((sum, group) => sum + group.points, 0)).toBe(100);
    }
    for (const [index, question] of surveys.export(survey.id).questions.entries()) {
      const result = reviewed.results[index];
      const preview = playableSurveyGroups(
        groupSurveyVariants(result.variants, reviewed.grouping[result.id] ?? {}),
      );
      expect(question.answers.map(({ text, points }) => ({ text, points }))).toEqual(
        preview.map(({ text, points }) => ({ text, points })),
      );
      expect(question.answers.map((answer) => answer.text)).toEqual(
        expected.map((_, index) => `Answer ${index + 1}`),
      );
      expect(question.answers.map((answer) => answer.points)).toEqual(expected);
      expect(question.answers.reduce((sum, answer) => sum + answer.points, 0)).toBe(100);
      expect(question.hostNotes).toContain(`cover ${shown} of ${total} nonblank responses`);
    }
  } finally {
    db.close();
  }
});
