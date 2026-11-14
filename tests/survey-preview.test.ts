import { expect, it } from "vitest";
import { groupSurveyVariants, playableSurveyGroups } from "@naija/contracts";
import { surveyDraftGroups } from "../apps/web/src/components/SurveyBoardPreview";

it("combines draft labels immediately without changing source responses", () => {
  const q = {
    id: "q1",
    prompt: "Name an item",
    answered: 7,
    groups: [],
    variants: [
      { key: "phone", text: "Phone", count: 3 },
      { key: "her phone", text: "Her phone", count: 1 },
      { key: "keys", text: "Keys", count: 3 },
    ],
  };
  const groups = surveyDraftGroups(q, { "her phone": "Phone" });
  expect(groups).toEqual([
    { text: "Phone", count: 4 },
    { text: "Keys", count: 3 },
  ]);
  expect(playableSurveyGroups(groups).map((g) => g.points)).toEqual([57, 43]);
  expect(q.variants[1].text).toBe("Her phone");
});

it("keeps rare responses and totals 100 across the playable board", () => {
  expect(
    playableSurveyGroups([
      { text: "Common", count: 200 },
      { text: "Rare", count: 1 },
    ]).map((g) => g.points),
  ).toEqual([99, 1]);
  const board = playableSurveyGroups(
    Array.from({ length: 9 }, (_, i) => ({ text: `Answer ${i}`, count: 1 })),
  );
  expect(board).toHaveLength(8);
  expect(board.reduce((s, g) => s + g.points, 0)).toBe(100);
});

it("handles prototype-like answer text without treating inherited properties as labels", () => {
  const variants = ["__proto__", "constructor", "toString"].map((text) => ({
    key: text,
    text,
    count: 1,
  }));
  expect(
    groupSurveyVariants(variants, {})
      .map((g) => g.text)
      .sort(),
  ).toEqual(variants.map((v) => v.text).sort());
  const mapping = Object.fromEntries([["__proto__", "Custom label"]]);
  expect(groupSurveyVariants(variants, mapping).some((g) => g.text === "Custom label")).toBe(true);
});
