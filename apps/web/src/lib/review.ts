import type { Question } from "@naija/contracts";
export const normalized = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function reviewQuestion(question: Question, questions: Question[]) {
  const warnings: string[] = [];
  if (
    questions.some(
      (other) =>
        other.id !== question.id && normalized(other.prompt) === normalized(question.prompt),
    )
  )
    warnings.push("Repeated question prompt in this pack.");
  const owners = new Map<string, string>();
  for (const answer of question.answers) {
    for (const variant of [answer.text, ...answer.acceptedAlternatives]) {
      const key = normalized(variant);
      if (!key) continue;
      const owner = owners.get(key);
      if (owner && owner !== answer.id)
        warnings.push(`“${variant}” matches more than one answer. Clarify the accepted meanings.`);
      owners.set(key, answer.id);
    }
  }
  return [...new Set(warnings)];
}
