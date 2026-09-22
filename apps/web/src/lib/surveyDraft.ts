export type SurveyKind = "regular" | "fast-money";

export function parseCustomQuestions(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      const key = line.replace(/\s+/g, " ").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function surveyDraftError({
  title,
  kind,
  questionCount,
}: {
  title: string;
  kind: SurveyKind;
  questionCount: number;
}): string {
  if (!title.trim()) return "Add a survey title.";
  if (title.trim().length > 100) return "Survey titles must be 100 characters or fewer.";
  if (kind === "fast-money" && questionCount !== 5) {
    return "Fast Money surveys need exactly 5 questions.";
  }
  if (questionCount < 5) return "Add at least 5 questions before creating the survey.";
  if (questionCount > 30) return "A survey can contain at most 30 questions.";
  return "";
}
