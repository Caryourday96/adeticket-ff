import { describe, expect, it } from "vitest";
import { parseCustomQuestions, surveyDraftError } from "../apps/web/src/lib/surveyDraft";

describe("survey draft validation", () => {
  it("trims and removes repeated custom questions", () => {
    expect(
      parseCustomQuestions(" Name something fun \nname   something fun\n\nName a song"),
    ).toEqual(["Name something fun", "Name a song"]);
  });

  it("requires five questions and exactly five for Fast Money", () => {
    expect(surveyDraftError({ title: "Survey", kind: "regular", questionCount: 4 })).toMatch(
      /at least 5/,
    );
    expect(surveyDraftError({ title: "Fast Money", kind: "fast-money", questionCount: 6 })).toMatch(
      /exactly 5/,
    );
    expect(surveyDraftError({ title: "Fast Money", kind: "fast-money", questionCount: 5 })).toBe(
      "",
    );
  });
});
