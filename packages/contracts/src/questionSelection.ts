import type { Question } from "./index";

export type QuestionUse = { prompt: string; game: string; roundType: "regular" | "fast-money" };
export const questionKey = (prompt: string) => prompt.trim().replace(/\s+/g, " ").toLowerCase();

export function questionUseCounts(usage: QuestionUse[]) {
  const games = new Map<string, Set<string>>();
  for (const row of usage) {
    const key = questionKey(row.prompt);
    if (!games.has(key)) games.set(key, new Set());
    games.get(key)!.add(row.game);
  }
  return new Map([...games].map(([key, ids]) => [key, ids.size]));
}

export function eligibleQuestions(questions: Question[], usage: QuestionUse[], limit?: number) {
  const counts = questionUseCounts(usage);
  const seen = new Set<string>();
  return questions.filter((q) => {
    const key = questionKey(q.prompt);
    if (seen.has(key) || (limit !== undefined && (counts.get(key) ?? 0) >= limit)) return false;
    seen.add(key);
    return true;
  });
}
