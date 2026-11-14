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
    { confidence: "uncertain", target: { text: "Phone" }, sources: [{ key: "home phone" }] },
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
  ).toMatchObject([
    { questionId: "q1", target: { text: "Phone", count: 4 }, sources: [{ key: "her phone" }] },
  ]);
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
  expect(suggestions).toHaveLength(3);
  expect(suggestions.every((suggestion) => suggestion.confidence === "uncertain")).toBe(true);
});

it("uses question context for semantic phrases and always asks before merging them", () => {
  const results = [
    question("q1", "What habit is she known for?", [
      ["Always late", 3],
      ["Lateness", 2],
      ["Arriving late", 1],
    ]),
    question("q2", "Name a food she likes to eat.", [
      ["Chips", 3],
      ["Fries", 2],
    ]),
    question("q3", "Name a brand.", [
      ["Chips", 3],
      ["Fries", 2],
    ]),
    question("q4", "Name something she cannot leave home without.", [
      ["Phone", 3],
      ["Mobile", 2],
      ["Her phone", 1],
    ]),
  ];
  const suggestions = suggestSurveyGroups({ open: false, reviewed: [], grouping: {}, results });
  expect(suggestions.filter((s) => s.questionId === "q1")).toHaveLength(2);
  expect(suggestions.find((s) => s.questionId === "q2")).toMatchObject({
    confidence: "uncertain",
    reason: expect.stringContaining("food or drink"),
  });
  expect(suggestions.some((s) => s.questionId === "q3")).toBe(false);
  expect(suggestions.filter((s) => s.questionId === "q4")).toHaveLength(2);
  expect(suggestions.find((s) => s.sources[0].key === "mobile")?.confidence).toBe("uncertain");
});

it("offers every extra variant against one stable target without a merge chain", () => {
  const results = [
    question("q1", "Name something she carries.", [
      ["Phone", 5],
      ["Her phone", 3],
      ["Work phone", 2],
      ["Home phone", 1],
    ]),
  ];
  const survey = { open: false, reviewed: [], grouping: {}, results };
  const suggestions = suggestSurveyGroups(survey);
  expect(suggestions).toHaveLength(3);
  expect(suggestions.every((s) => s.target.text === "Phone")).toBe(true);
  expect(new Set(suggestions.flatMap((s) => s.sources.map((v) => v.key))).size).toBe(3);
  expect(suggestSurveyGroups(survey)).toEqual(suggestions);
});

it("preserves manual labels and keep-separate decisions, but adds unmatched variants", () => {
  const results = [
    question("q1", "Name something she carries.", [
      ["Phone", 5],
      ["Her phone", 3],
      ["Mobile", 2],
      ["Cellphone", 1],
    ]),
  ];
  const grouping = { q1: { "her phone": "Phone", mobile: "Mobile" } };
  const before = JSON.stringify(grouping);
  const suggestions = suggestSurveyGroups({ open: false, reviewed: [], grouping, results });
  expect(suggestions).toHaveLength(1);
  expect(suggestions[0]).toMatchObject({
    target: { text: "Phone", count: 8 },
    sources: [{ key: "cellphone" }],
    confidence: "uncertain",
  });
  expect(JSON.stringify(grouping)).toBe(before);
  expect(suggestSurveyGroups({ open: false, reviewed: ["q1"], grouping, results })).toEqual([]);
});

it("does not propose negated answers or different owners as equivalents", () => {
  const results = [
    question("q1", "Describe her personality.", [
      ["Funny", 3],
      ["Not funny", 2],
      ["Never funny", 1],
    ]),
    question("q2", "Whose phone does she bring?", [
      ["Her phone", 3],
      ["His phone", 2],
    ]),
    question("q3", "Name her favourite food.", [
      ["Jollof rice", 3],
      ["Fried rice", 2],
    ]),
  ];
  expect(suggestSurveyGroups({ open: false, reviewed: [], grouping: {}, results })).toEqual([]);
});
