import { expect, it } from "vitest";
import type { SurveyResults } from "@naija/contracts";
import { suggestSurveyGroups } from "../apps/web/src/lib/surveyReview";

function question(id: string, prompt: string, answers: [string, number][]) {
  return {
    id,
    prompt,
    answered: answers.reduce((total, [, count]) => total + count, 0),
    variants: answers.map(([text, count]) => ({ key: text.toLowerCase(), text, count })),
    groups: [],
  } satisfies SurveyResults["results"][number];
}

it("suggests clear aliases per question and leaves unrelated answers alone", () => {
  const survey = {
    open: false,
    reviewed: [],
    grouping: {},
    results: [
      question("q1", "Name something the birthday girl can't leave the house without.", [
        ["Phone", 3],
        ["Lip balm", 3],
        ["Her phone", 1],
        ["Sunglasses", 1],
        ["Being late", 1],
      ]),
      question("q2", "Name something you bring to a party.", [
        ["Jollof", 3],
        ["Jollof rice", 1],
        ["Fried rice", 1],
      ]),
    ],
  };
  expect(suggestSurveyGroups(survey)).toMatchObject([
    {
      questionId: "q1",
      confidence: "clear",
      target: { text: "Phone", count: 3 },
      sources: [{ key: "her phone", count: 1 }],
    },
    {
      questionId: "q2",
      confidence: "clear",
      target: { text: "Jollof rice" },
      sources: [{ key: "jollof" }],
    },
  ]);
  expect(survey.grouping).toEqual({});
});

it("keeps specific answers and typos as questions for the host", () => {
  const results = [
    question("q1", "Name an object.", [
      ["Phone", 5],
      ["Work phone", 3],
      ["Home phone", 2],
      ["Wallet", 1],
      ["Walet", 1],
    ]),
  ];
  expect(suggestSurveyGroups({ open: false, reviewed: [], grouping: {}, results })).toMatchObject([
    { confidence: "uncertain", target: { text: "Phone" }, sources: [{ key: "work phone" }] },
    { confidence: "uncertain", target: { text: "Walet" }, sources: [{ key: "wallet" }] },
  ]);
});

it("preserves edits and completed reviews, including groups already using a matching label", () => {
  const results = [
    question("q1", "Name something she brings with her.", [
      ["Phone", 3],
      ["Her phone", 2],
      ["Cellphone", 1],
    ]),
    question("q2", "Name some party food.", [
      ["Jollof", 2],
      ["Jollof rice", 1],
    ]),
  ];
  expect(
    suggestSurveyGroups({
      open: false,
      reviewed: ["q2"],
      grouping: { q1: { cellphone: "Phone" } },
      results,
    }),
  ).toEqual([]);
  expect(suggestSurveyGroups({ open: true, reviewed: [], grouping: {}, results })).toEqual([]);
});

it("asks about ownership wording instead of automatically merging it", () => {
  const results = [
    question("q1", "Whose phone would she bring?", [
      ["Phone", 2],
      ["Her phone", 1],
    ]),
    question("q2", "Name something she brings with her.", [
      ["Phone", 3],
      ["Her phone", 2],
      ["His phone", 1],
    ]),
  ];
  const suggestions = suggestSurveyGroups({ open: false, reviewed: [], grouping: {}, results });
  expect(suggestions).toHaveLength(2);
  expect(suggestions.every((suggestion) => suggestion.confidence === "uncertain")).toBe(true);
});
