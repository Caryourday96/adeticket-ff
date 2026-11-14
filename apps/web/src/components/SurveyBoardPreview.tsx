import { playableSurveyGroups, groupSurveyVariants, type SurveyResults } from "@naija/contracts";

type Question = SurveyResults["results"][number];
const normalize = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();

export function surveyDraftGroups(question: Question, mapping: Record<string, string>) {
  return groupSurveyVariants(question.variants, mapping).map(({ text, count }) => ({
    text,
    count,
  }));
}

export function SurveyBoardPreview({
  question,
  mapping,
  savedMapping,
}: {
  question: Question;
  mapping: Record<string, string>;
  savedMapping: Record<string, string>;
}) {
  const groups = surveyDraftGroups(question, mapping);
  const dirty = [...new Set([...Object.keys(mapping), ...Object.keys(savedMapping)])].some(
    (key) => mapping[key] !== savedMapping[key],
  );
  const invalid = groups.some((group) => !group.text);
  const board = playableSurveyGroups(groups);
  const shown = board.reduce((sum, group) => sum + group.count, 0);
  return (
    <section className="survey-board-preview" aria-label={`Combined preview: ${question.prompt}`}>
      <h4>Combined answers</h4>
      <p role="status">
        {dirty
          ? "Unsaved group changes — save grouping and review below to keep them."
          : "Group totals match the saved answers."}
      </p>
      <p>Original answer rows stay below so you can check or change each grouping.</p>
      <p>
        {groups
          .map((group) => `${group.text || "Missing group name"}: ${group.count} responses`)
          .join(" · ") || "No answers yet"}
      </p>
      <h4>Game board preview</h4>
      {invalid ? (
        <p>Enter a Group label for every answer before saving.</p>
      ) : board.length < 2 ? (
        <p>At least two answer groups are needed to export this question.</p>
      ) : (
        <>
          <ol>
            {board.map((group) => (
              <li key={normalize(group.text)}>
                {group.text}: {group.count} responses / <strong>{group.points} points</strong>
              </li>
            ))}
          </ol>
          <p>
            <strong>
              Board total: {board.reduce((sum, group) => sum + group.points, 0)} points
            </strong>
          </p>
          <p>
            Shows {board.length} of {groups.length} groups, covering {shown} of {question.answered}{" "}
            answers.
            {groups.length > board.length
              ? " Remaining groups are omitted from the game board; their original responses are kept."
              : ""}
          </p>
        </>
      )}
    </section>
  );
}
