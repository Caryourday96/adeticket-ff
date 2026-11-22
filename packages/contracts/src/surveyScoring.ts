import type { SurveyChoiceCount } from "./surveys";

// Each first choice contributes two votes of weight and each second choice contributes one.
const votingWeight = (group: SurveyChoiceCount) => group.count * 2 - (group.secondChoices ?? 0);
const firstChoices = (group: SurveyChoiceCount) => group.count - (group.secondChoices ?? 0);

type CountedAnswer = SurveyChoiceCount & { text: string };
const bySurveyRank = (a: CountedAnswer, b: CountedAnswer) =>
  votingWeight(b) - votingWeight(a) ||
  firstChoices(b) - firstChoices(a) ||
  a.text.localeCompare(b.text);

export function groupSurveyVariants(
  variants: (CountedAnswer & { key: string })[],
  mapping: Record<string, string>,
) {
  const groups = new Map<string, CountedAnswer & { alternatives: string[] }>();
  // Stable label selection even when the server and browser received variants in a different order.
  for (const variant of [...variants].sort((a, b) => a.key.localeCompare(b.key))) {
    const mapped = Object.hasOwn(mapping, variant.key) ? mapping[variant.key] : undefined;
    const text = (typeof mapped === "string" ? mapped : variant.text).trim();
    const key = text.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
    const group = groups.get(key) ?? { text, count: 0, alternatives: [] };
    group.count += variant.count;
    if (variant.secondChoices)
      group.secondChoices = (group.secondChoices ?? 0) + variant.secondChoices;
    group.alternatives.push(variant.text);
    groups.set(key, group);
  }
  return [...groups.values()].sort(bySurveyRank);
}

// Groups are ordered by voting weight before distributing playable points.
export function scoreGroups<T extends CountedAnswer>(
  groups: T[],
  pointsAvailable = 100,
  requirePositive = false,
): (T & { points: number })[] {
  const total = groups.reduce((sum, group) => sum + votingWeight(group), 0);
  const scored = groups.map((group) => ({
    ...group,
    points: total > 0 ? Math.floor((votingWeight(group) * pointsAvailable) / total) : 0,
  }));
  if (total === 0) return scored;

  // Award the remaining points by largest remainder with stable count and label tie breaks.
  const remainder = pointsAvailable - scored.reduce((sum, group) => sum + group.points, 0);
  const ranked = [...scored].sort(
    (a, b) =>
      ((votingWeight(b) * pointsAvailable) % total) -
        ((votingWeight(a) * pointsAvailable) % total) || bySurveyRank(a, b),
  );
  for (const group of ranked.slice(0, remainder)) group.points++;

  if (!requirePositive) return scored;
  const firstZero = scored.findIndex((group) => group.points === 0);
  if (firstZero === -1) return scored;

  // The game requires at least one point per answer. Retain the chosen groups even when
  // redistributing the omitted groups' points rounds one of the smallest shares to zero.
  const smallest = scored.slice(firstZero);
  return [
    ...scoreGroups(groups.slice(0, firstZero), pointsAvailable - smallest.length, true),
    ...smallest.map((group) => ({ ...group, points: 1 })),
  ];
}

export function playableSurveyGroups<T extends CountedAnswer>(groups: T[]) {
  return scoreGroups(
    [...groups]
      .filter((g) => g.count > 0)
      .sort(bySurveyRank)
      .slice(0, 8),
    100,
    true,
  );
}

export function savedSurveyBoard<T extends CountedAnswer>(
  groups: T[],
  board?: { text: string; points: number }[],
) {
  if (!board) return playableSurveyGroups(groups);
  const normalize = (s: string) =>
    s.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return board
    .map((answer) => {
      const group = groups.find((g) => normalize(g.text) === normalize(answer.text));
      if (!group) throw new Error("Saved board no longer matches answer groups.");
      return { ...group, points: answer.points };
    })
    .sort((a, b) => b.points - a.points);
}
