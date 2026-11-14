import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { Surveys } from "../apps/server/src/surveys";

it.each([
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
    for (const question of surveys.export(survey.id).questions) {
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
