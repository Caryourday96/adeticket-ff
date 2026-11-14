import type { SurveyResults } from "@naija/contracts";

type Variant = SurveyResults["results"][number]["variants"][number];
type ReviewableSurvey = Pick<SurveyResults, "open" | "results" | "grouping" | "reviewed">;

export type SurveyGroupSuggestion = {
  questionId: string;
  prompt: string;
  target: Variant;
  sources: Variant[];
  confidence: "clear" | "uncertain";
  reason: string;
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
    .replace(/[’‘]/g, "'")
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

// Deliberately bounded local vocabulary. These are questions for the host, not automatic merges.
const contexts = [
  {
    name: "items someone carries or wears",
    prompt:
      /\b(leave|leaves|bring|brings|carry|carries|take|takes|pack|packs|use|uses|need|needs|wear|wears|bag|handbag|without)\b/i,
    families: [
      ["phone", "mobile", "mobile phone", "cell phone", "smartphone"],
      ["headphones", "earphones", "earbuds", "airpods"],
      ["hand sanitizer", "sanitizer"],
      ["lip balm", "chapstick"],
      ["perfume", "fragrance"],
      ["handbag", "purse"],
    ],
  },
  {
    name: "food or drink",
    prompt:
      /\b(food|eat|eats|eating|meal|dish|cook|cooks|cooking|snack|drink|drinks|crave|craves|craving)\b/i,
    families: [
      ["chips", "fries", "french fries"],
      ["soft drink", "soda", "pop", "fizzy drink"],
      ["barbecue", "bbq"],
    ],
  },
  {
    name: "habits or personality",
    prompt:
      /\b(habit|habits|personality|trait|traits|describe|describes|behaviour|behavior|known|late|lateness|annoy|annoys)\b/i,
    families: [
      [
        "late",
        "being late",
        "always late",
        "lateness",
        "arriving late",
        "coming late",
        "she is always late",
        "she's always late",
      ],
      [
        "funny",
        "humour",
        "humor",
        "sense of humour",
        "sense of humor",
        "making people laugh",
        "makes people laugh",
      ],
      ["kind", "kindness", "kind heart", "kind hearted", "kind-hearted"],
      ["generous", "generosity", "giving", "helping others"],
      ["talkative", "talking a lot", "talks a lot", "always talking"],
    ],
  },
  {
    name: "activities or free time",
    prompt:
      /\b(hobby|hobbies|activity|activities|relax|relaxes|weekend|free time|spare time|for fun)\b/i,
    families: [
      ["sleep", "sleeping", "nap", "napping", "taking naps"],
      ["gym", "going to the gym", "working out", "exercise", "exercising"],
      ["watching movies", "watch movies", "watching films", "watch films"],
      ["shopping", "going shopping", "shop"],
    ],
  },
];

const possessive = (name: string) => /^(her|his|their) (.+)$/.exec(name);
const negation = /\b(no|not|never|without|neither|nor|isn't|isnt|doesn't|doesnt|don't|dont)\b/;
type Anchor = { target: Variant; members: Variant[]; locked: boolean; name: string };

// Answers never leave the browser. Existing labels are stable targets, never automatic sources.
export function suggestSurveyGroups(survey: ReviewableSurvey): SurveyGroupSuggestion[] {
  if (survey.open) return [];
  const suggestions: SurveyGroupSuggestion[] = [];
  for (const question of survey.results) {
    if (survey.reviewed.includes(question.id)) continue;
    const mapping = survey.grouping[question.id] ?? {};
    const groups = new Map<string, Anchor>();
    for (const variant of question.variants) {
      const mapped = Object.hasOwn(mapping, variant.key) ? mapping[variant.key] : undefined;
      const text = (typeof mapped === "string" ? mapped : variant.text).trim();
      if (!text) continue;
      const key = normalize(text);
      const group = groups.get(key) ?? {
        target: { key, text, count: 0 },
        members: [],
        locked: false,
        name: canonical(text),
      };
      group.target.count += variant.count;
      group.members.push(variant);
      group.locked ||= Object.hasOwn(mapping, variant.key);
      groups.set(key, group);
    }
    const candidates = [...groups.values()].sort(
      (a, b) =>
        Number(b.locked) - Number(a.locked) ||
        Number(normalize(b.target.text) === b.name && !possessive(b.name)) -
          Number(normalize(a.target.text) === a.name && !possessive(a.name)) ||
        b.target.count - a.target.count ||
        a.target.key.localeCompare(b.target.key),
    );
    const owners = new Map<string, Set<string>>();
    for (const candidate of candidates) {
      const match = possessive(candidate.name);
      if (match) {
        const base = canonical(match[2]);
        const terms = owners.get(base) ?? new Set<string>();
        terms.add(match[1]);
        owners.set(base, terms);
      }
    }
    const ownershipQuestion = /\b(whose|owns?|owner|belongs?|ownership)\b/i.test(question.prompt);
    const itemPrompt = contexts[0].prompt.test(question.prompt) && !ownershipQuestion;
    function match(
      a: Anchor,
      b: Anchor,
    ): Pick<SurveyGroupSuggestion, "confidence" | "reason"> | null {
      if (a.name === b.name)
        return {
          confidence: "clear",
          reason: "Same wording after spelling and punctuation normalization.",
        };
      // Do not treat an opposite or an explicitly negated answer as a similar answer.
      if (negation.test(a.name) || negation.test(b.name)) return null;
      const aOwner = possessive(a.name),
        bOwner = possessive(b.name);
      if (aOwner && bOwner && aOwner[1] !== bOwner[1]) return null;
      const aBase = canonical(aOwner?.[2] ?? a.name),
        bBase = canonical(bOwner?.[2] ?? b.name);
      if (itemPrompt && aBase === bBase && owners.get(aBase)?.size === 1) {
        return {
          confidence: "clear",
          reason: "In this item question, the possessive refers to the same named item.",
        };
      }
      if (!ownershipQuestion)
        for (const context of contexts) {
          if (
            context.prompt.test(question.prompt) &&
            context.families.some((family) => family.includes(aBase) && family.includes(bBase))
          ) {
            return {
              confidence: "uncertain",
              reason: `This question is about ${context.name}. These phrases may mean the same thing here, but details can differ. Please confirm.`,
            };
          }
        }
      if (plausibleWording(a.name, b.name))
        return {
          confidence: "uncertain",
          reason:
            "Similar wording or a more specific answer. Check the question before combining them.",
        };
      return null;
    }
    const anchors: Anchor[] = [];
    for (const candidate of candidates) {
      if (candidate.locked) {
        anchors.push(candidate);
        continue;
      }
      // Bound fuzzy comparisons on unusually large surveys; exact matches still use all anchors.
      const exact = anchors.find((anchor) => anchor.name === candidate.name);
      const possibilities = (exact ? [exact] : anchors.slice(0, 100))
        .map((anchor) => ({ anchor, result: match(anchor, candidate) }))
        .filter((entry) => entry.result !== null)
        .sort(
          (a, b) =>
            Number(b.result!.confidence === "clear") - Number(a.result!.confidence === "clear"),
        );
      const found = possibilities[0];
      if (!found) {
        anchors.push(candidate);
        continue;
      }
      suggestions.push({
        questionId: question.id,
        prompt: question.prompt,
        target: { ...found.anchor.target },
        sources: candidate.members,
        ...found.result!,
      });
      // Keep the original target as an anchor so third/fourth variants are not lost or chained.
    }
  }
  return suggestions;
}
