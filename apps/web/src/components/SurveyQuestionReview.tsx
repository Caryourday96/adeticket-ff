import { useState } from "react";
import { groupSurveyVariants, savedSurveyBoard, type SurveyResults } from "@naija/contracts";
import { api } from "../lib/api";
import { suggestSurveyGroups } from "../lib/surveyReview";

export function SurveyQuestionReview({
  survey,
  savedGrouping,
  busy,
  onAction,
}: {
  survey: SurveyResults;
  savedGrouping: SurveyResults["grouping"];
  busy: boolean;
  onAction: (action: (saved: SurveyResults) => Promise<SurveyResults>) => void;
}) {
  const [index, setIndex] = useState(0),
    [selected, setSelected] = useState<string[]>([]),
    [name, setName] = useState("");
  const q = survey.results[index];
  const groups = groupSurveyVariants(q.variants, survey.grouping[q.id] ?? {});
  const signature = (mapping: Record<string, string>) =>
    JSON.stringify(Object.entries(mapping).sort(([a], [b]) => a.localeCompare(b)));
  const board = savedSurveyBoard(
    groups,
    signature(survey.grouping[q.id] ?? {}) === signature(savedGrouping[q.id] ?? {})
      ? survey.boards?.[q.id]
      : undefined,
  );
  const suggestions = suggestSurveyGroups({ ...survey, results: [q], reviewed: [] }).filter((s) =>
    [s.target.text, ...s.sources.map((v) => v.text)].every((text) =>
      board.some((g) => g.text === text),
    ),
  );
  const chosen = board.filter((g) => selected.includes(g.text));
  function move(next: number) {
    setIndex(next);
    setSelected([]);
    setName("");
  }
  return (
    <section className="settings-card survey-board-preview" aria-label="Question review">
      <h2>
        Question {index + 1} of {survey.results.length}
      </h2>
      <p>
        {survey.reviewed.length} of {survey.results.length} reviewed
      </p>
      <label>
        Go to question
        <select value={index} disabled={busy} onChange={(e) => move(Number(e.target.value))}>
          {survey.results.map((item, i) => (
            <option value={i} key={item.id}>
              {i + 1}. {survey.reviewed.includes(item.id) ? "Reviewed" : "Needs review"} —{" "}
              {item.prompt}
            </option>
          ))}
        </select>
      </label>
      <h3>{q.prompt}</h3>
      {!!suggestions.length && (
        <details>
          <summary>Suggested selections ({suggestions.length})</summary>
          {suggestions.map((s, i) => (
            <div key={i}>
              <p>{s.reason}</p>
              <button
                className="button"
                disabled={busy}
                onClick={() => {
                  setSelected([s.target.text, ...s.sources.map((v) => v.text)]);
                  setName(s.target.text);
                }}
              >
                Select {s.sources.map((v) => v.text).join(", ")} + {s.target.text}
              </button>
            </div>
          ))}
        </details>
      )}
      <p>
        Select two or more board answers, then name and confirm the merge. Their points are added;
        other scores stay unchanged.
      </p>
      {board.map((g) => (
        <label className="survey-choice" key={g.text}>
          <input
            type="checkbox"
            disabled={busy}
            checked={selected.includes(g.text)}
            onChange={(e) => {
              setSelected((old) =>
                e.target.checked ? [...old, g.text] : old.filter((text) => text !== g.text),
              );
              if (!name) setName(g.text);
            }}
          />
          <span>
            {g.text} · {g.count} responses · {g.points} points
          </span>
        </label>
      ))}
      <p>
        <strong>Board total: {board.reduce((n, g) => n + g.points, 0)} points</strong>.{" "}
        {groups.length > board.length
          ? `${groups.length - board.length} other groups are outside this board. Use the all-questions view to edit them.`
          : ""}
      </p>
      {chosen.length >= 2 && (
        <div>
          <label>
            Combined answer name
            <input
              maxLength={100}
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p>
            Merge preview: {name.trim() || "Choose a name"} —{" "}
            {chosen.reduce((n, g) => n + g.count, 0)} responses —{" "}
            {chosen.reduce((n, g) => n + g.points, 0)} points.
          </p>
          <button
            className="button primary"
            disabled={busy || !name.trim() || chosen.length === board.length}
            onClick={() =>
              onAction(async (saved) => {
                const result = await api<SurveyResults>(`/surveys/${saved.id}/merge`, {
                  revision: saved.revision,
                  questionId: q.id,
                  selected: chosen.map((g) => g.text),
                  text: name.trim(),
                });
                setSelected([]);
                setName("");
                return result;
              })
            }
          >
            Confirm merge
          </button>
          {chosen.length === board.length && (
            <p>Keep at least two answers so this question remains playable.</p>
          )}
        </div>
      )}
      <details>
        <summary>Original responses ({q.variants.length} wordings)</summary>
        <ul>
          {q.variants.map((v) => (
            <li key={v.key}>
              {v.text}: {v.count}
            </li>
          ))}
        </ul>
      </details>
      <p>
        Confirm merge saves the combined answer. Undo last merge restores its previous grouping and
        points, even after refreshing. Editing Group labels or reopening collection resets fixed
        merge scores.
      </p>
      <div className="button-row">
        <button
          className="button"
          disabled={busy || !survey.mergeUndo?.[q.id]}
          onClick={() =>
            onAction((saved) =>
              api<SurveyResults>(`/surveys/${saved.id}/merge`, {
                revision: saved.revision,
                questionId: q.id,
                undo: true,
              }),
            )
          }
        >
          Undo last merge
        </button>
        <button className="button" disabled={busy || index === 0} onClick={() => move(index - 1)}>
          Previous question
        </button>
        <button
          className="button"
          disabled={busy || index === survey.results.length - 1}
          onClick={() => move(index + 1)}
        >
          Skip for now
        </button>
        <button
          className="button primary"
          disabled={busy || board.length < 2}
          onClick={() =>
            onAction(async (saved) => {
              const result = await api<SurveyResults>(`/surveys/${saved.id}/review`, {
                revision: saved.revision,
                grouping: saved.grouping,
                reviewed: [...new Set([...saved.reviewed, q.id])],
              });
              if (index < survey.results.length - 1) move(index + 1);
              return result;
            })
          }
        >
          {index === survey.results.length - 1 ? "Save final question" : "Save and next question"}
        </button>
      </div>
      {survey.reviewed.length === survey.results.length && (
        <p role="status">
          All questions reviewed. Save the bank to the question library below when ready.
        </p>
      )}
    </section>
  );
}
