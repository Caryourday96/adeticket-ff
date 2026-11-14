import type { SurveyResults } from "@naija/contracts";

type Variant = SurveyResults["results"][number]["variants"][number];
type ReviewableSurvey = Pick<SurveyResults, "open" | "results" | "grouping" | "reviewed">;

export type SurveyGroupSuggestion = {
  questionId: string;
  prompt: string;
  target: Variant;
  sources: Variant[];
  confidence: "clear" | "uncertain";
};

const aliases = new Map([
  ["cellphone", "cell phone"],
  ["cell-phone", "cell phone"],
  ["ear phones", "earphones"],
  ["hand sanitiser", "hand sanitizer"],
  ["head phones", "headphones"],
  ["jollof", "jollof rice"],
  ["lipbalm", "lip balm"],
  ["sun glasses", "sunglasses"],
  ["sun-glasses", "sunglasses"],
]);

function normalize(label: string) {
  return label.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function canonical(label: string) {
  const normalized = normalize(label)
    .replace(/[.!?]+$/, "")
    .trim();
  return aliases.get(normalized) ?? normalized;
}

function plausibleWording(a: string, b: string) {
  if (a.length < 4 || b.length < 4 || a.length > 48 || b.length > 48) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  // A more specific answer might belong in an existing group. Ask rather than merging it.
  if (longer.endsWith(` ${shorter}`) && longer.split(" ").length <= 3) return true;
  if (longer.length - shorter.length > 1) return false;
  let firstDifference = 0;
  while (firstDifference < shorter.length && shorter[firstDifference] === longer[firstDifference])
    firstDifference++;
  if (longer.length > shorter.length)
    return shorter.slice(firstDifference) === longer.slice(firstDifference + 1);
  if (firstDifference === shorter.length) return false;
  if (shorter.slice(firstDifference + 1) === longer.slice(firstDifference + 1)) return true;
  return (
    shorter[firstDifference] === longer[firstDifference + 1] &&
    shorter[firstDifference + 1] === longer[firstDifference] &&
    shorter.slice(firstDifference + 2) === longer.slice(firstDifference + 2)
  );
}

// Survey results and decisions stay in the browser. The caller stages proposals for review.
export function suggestSurveyGroups(survey: ReviewableSurvey): SurveyGroupSuggestion[] {
  if (survey.open) return [];
  const suggestions: SurveyGroupSuggestion[] = [];
  const reviewed = new Set(survey.reviewed);

  for (const question of survey.results) {
    if (reviewed.has(question.id)) continue;
    const mapping = survey.grouping[question.id] ?? {};
    const mappedLabels = new Set(Object.values(mapping).map(normalize));
    const candidates = question.variants
      .filter((v) => !Object.hasOwn(mapping, v.key) && !mappedLabels.has(normalize(v.text)))
      .map((v) => {
        const name = canonical(v.text);
        const possessive = /^(her|his|their) (.+)$/.exec(name);
        return { variant: v, name, possessive };
      })
      .filter(({ name }) => name.length > 0)
      .sort(
        (a, b) => b.variant.count - a.variant.count || a.variant.key.localeCompare(b.variant.key),
      );

    const plainNames = new Set(candidates.filter((v) => !v.possessive).map((v) => v.name));
    const owners = new Map<string, Set<string>>();
    for (const { possessive } of candidates) {
      if (!possessive) continue;
      const base = canonical(possessive[2]);
      const terms = owners.get(base) ?? new Set<string>();
      terms.add(possessive[1]);
      owners.set(base, terms);
    }

    // A possessive is incidental in many item questions. Do not strip it in questions about ownership.
    const itemPrompt =
      /\b(?:name|what|which)\b.*\b(?:leave|leaves|bring|brings|carry|carries|take|takes|pack|packs|use|uses|need|needs|wear|wears)\b/i.test(
        question.prompt,
      ) && !/\b(?:whose|owns?|owner|belongs?|ownership)\b/i.test(question.prompt);
    const buckets = new Map<string, typeof candidates>();
    for (const candidate of candidates) {
      const base = candidate.possessive && canonical(candidate.possessive[2]);
      const key =
        itemPrompt && base && plainNames.has(base) && owners.get(base)?.size === 1
          ? base
          : candidate.name;
      const bucket = buckets.get(key) ?? [];
      bucket.push(candidate);
      buckets.set(key, bucket);
    }

    const used = new Set<string>();
    const propose = (target: Variant, sources: Variant[], confidence: "clear" | "uncertain") => {
      used.add(target.key);
      for (const source of sources) used.add(source.key);
      suggestions.push({
        questionId: question.id,
        prompt: question.prompt,
        target,
        sources,
        confidence,
      });
    };
    for (const [name, bucket] of buckets) {
      if (bucket.length < 2) continue;
      const preferred = bucket.find((v) => normalize(v.variant.text) === name);
      const target = (preferred ?? bucket.find((v) => v.name === name) ?? bucket[0]).variant;
      propose(
        target,
        bucket.map(({ variant }) => variant).filter((v) => v.key !== target.key),
        "clear",
      );
    }

    // Limit pairwise typo checks to the most common unmatched variants of each question.
    const remaining = candidates.filter(({ variant }) => !used.has(variant.key)).slice(0, 100);
    for (const [index, candidate] of remaining.entries()) {
      if (used.has(candidate.variant.key)) continue;
      const matchIndex = remaining.findIndex(
        (other, otherIndex) =>
          otherIndex > index &&
          !used.has(other.variant.key) &&
          plausibleWording(candidate.name, other.name),
      );
      if (matchIndex >= 0) propose(candidate.variant, [remaining[matchIndex].variant], "uncertain");
    }
  }
  return suggestions;
}
