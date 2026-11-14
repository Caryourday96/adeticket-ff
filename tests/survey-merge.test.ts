import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { Surveys } from "../apps/server/src/surveys";
import { savedSurveyBoard } from "@naija/contracts";
it("adds points, persists merge/undo, validates conflicts and preserves original answers", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const store = new Surveys(db);
    const s = store.create({
      title: "Merge fixture",
      roundType: "regular",
      questions: Array.from({ length: 5 }, (_, i) => ({ prompt: `Question number ${i}` })),
    });
    for (let i = 1; i <= 6; i++)
      store.submit(s.id, String(i), {
        answers: Object.fromEntries(s.questions.map((q) => [q.id, `Answer ${i}`])),
      });
    let current = store.setOpen(s.id, false, store.get(s.id).revision);
    current = store.review(s.id, {
      revision: current.revision,
      grouping: {},
      reviewed: s.questions.map((q) => q.id),
    });
    const original = store.export(s.id).questions[0].answers;
    const payload = {
      revision: current.revision,
      questionId: "q1",
      selected: ["Answer 1", "Answer 2", "Answer 3"],
      text: "Merged",
    };
    expect(() => store.merge(s.id, { ...payload, selected: ["Answer 1", "Answer 1"] })).toThrow(
      /at least two/,
    );
    expect(() => store.merge(s.id, { ...payload, text: "Answer 4" })).toThrow(/unselected/);
    expect(() => store.merge(s.id, { ...payload, selected: original.map((a) => a.text) })).toThrow(
      /at least two/,
    );
    current = store.merge(s.id, payload);
    expect(() => store.merge(s.id, payload)).toThrow(/changed/);
    expect(current.results[0].variants).toHaveLength(6);
    expect(current.results[0].groups.find((g) => g.text === "Merged")?.count).toBe(3);
    expect(
      savedSurveyBoard(current.results[0].groups, current.boards?.q1).map((g) => g.points),
    ).toEqual([51, 17, 16, 16]);
    expect(() => store.export(s.id)).toThrow(/review/);
    current = store.review(s.id, {
      revision: current.revision,
      grouping: current.grouping,
      reviewed: s.questions.map((q) => q.id),
    });
    const reopened = new Surveys(db);
    expect(reopened.export(s.id).questions[0].answers.map((a) => a.points)).toEqual([
      51, 17, 16, 16,
    ]);
    expect(reopened.export(s.id).questions[0].answers[0].acceptedAlternatives).toEqual([
      "Answer 1",
      "Answer 2",
      "Answer 3",
    ]);
    current = store.merge(s.id, { revision: current.revision, questionId: "q1", undo: true });
    expect(store.export(s.id).questions[0].answers).toEqual(original);
    current = store.merge(s.id, { ...payload, revision: current.revision });
    current = store.setOpen(s.id, true, current.revision);
    expect(current.boards).toEqual({});
    expect(() => store.merge(s.id, { ...payload, revision: current.revision })).toThrow(/Close/);
  } finally {
    db.close();
  }
});
