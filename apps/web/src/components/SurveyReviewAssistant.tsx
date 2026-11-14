import { useState } from "react";
import type { SurveyResults } from "@naija/contracts";
import { suggestSurveyGroups, type SurveyGroupSuggestion } from "../lib/surveyReview";

type Review = {
  source: SurveyResults;
  clear: SurveyGroupSuggestion[];
  uncertain: SurveyGroupSuggestion[];
};

function MergeSummary({ suggestion }: { suggestion: SurveyGroupSuggestion }) {
  const answers = [...suggestion.sources, suggestion.target];
  return (
    <>
      {answers.map(({ text, count }) => `“${text}” (${count})`).join(" + ")} →{" "}
      <strong>{suggestion.target.text}</strong> (
      {answers.reduce((n, answer) => n + answer.count, 0)} combined)
    </>
  );
}

export function SurveyReviewAssistant({
  survey,
  busy,
  onApply,
}: {
  survey: SurveyResults;
  busy: boolean;
  onApply: (suggestions: SurveyGroupSuggestion[]) => void;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [choices, setChoices] = useState<boolean[]>([]);
  const [message, setMessage] = useState("");
  const current = review?.uncertain[choices.length];
  const stale = !!review && review.source !== survey;

  function start() {
    const suggestions = suggestSurveyGroups(survey);
    setReview({
      source: survey,
      clear: suggestions.filter((suggestion) => suggestion.confidence === "clear"),
      uncertain: suggestions.filter((suggestion) => suggestion.confidence === "uncertain"),
    });
    setExcluded([]);
    setChoices([]);
    setMessage("");
  }

  function apply() {
    if (!review || stale || current) return;
    const selected = [
      ...review.clear.filter((_, index) => !excluded.includes(index)),
      ...review.uncertain.filter((_, index) => choices[index]),
    ];
    if (selected.length) onApply(selected);
    setReview(null);
    setMessage(
      selected.length
        ? `Added ${selected.length} ${selected.length === 1 ? "merge" : "merges"} to the draft. Check the Group fields below, mark each question you reviewed, then save.`
        : "No merges applied.",
    );
  }

  return (
    <section className="settings-card survey-assistant" aria-labelledby="survey-assistant-heading">
      <h3 id="survey-assistant-heading">Answer review assistant</h3>
      <p>Find likely duplicates across the survey and decide which answers belong together.</p>
      {!review && (
        <button className="button primary" disabled={busy} onClick={start}>
          Auto review answers
        </button>
      )}
      {message && <p role="status">{message}</p>}
      {stale ? (
        <>
          <p role="status">
            The draft changed during review. Run auto review again to use the latest groups.
          </p>
          <button className="button" disabled={busy} onClick={start}>
            Run auto review again
          </button>
        </>
      ) : (
        review && (
          <>
            {!review.clear.length && !review.uncertain.length && (
              <p role="status">
                No likely duplicates found in questions awaiting review. You can still edit any
                Group field below.
              </p>
            )}
            {!!review.clear.length && (
              <div className="survey-assistant-options">
                <h4>Suggested merges</h4>
                {review.clear.map((suggestion, index) => (
                  <label
                    className="survey-choice"
                    key={`${suggestion.questionId}:${suggestion.target.key}`}
                  >
                    <input
                      type="checkbox"
                      checked={!excluded.includes(index)}
                      disabled={busy}
                      onChange={(event) =>
                        setExcluded((old) =>
                          event.target.checked
                            ? old.filter((value) => value !== index)
                            : [...old, index],
                        )
                      }
                    />
                    <span>
                      <span className="survey-assistant-prompt">{suggestion.prompt}</span>
                      <MergeSummary suggestion={suggestion} />
                    </span>
                  </label>
                ))}
              </div>
            )}
            {current ? (
              <div className="survey-assistant-question" aria-live="polite">
                <p>
                  Decision {choices.length + 1} of {review.uncertain.length}
                </p>
                <h4>Should these answers count together?</h4>
                <p>{current.prompt}</p>
                <p>
                  <MergeSummary suggestion={current} />
                </p>
                <div className="button-row">
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => setChoices([...choices, true])}
                  >
                    Merge answers
                  </button>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => setChoices([...choices, false])}
                  >
                    Keep separate
                  </button>
                </div>
              </div>
            ) : (
              !!choices.length && (
                <div className="survey-assistant-options">
                  <h4>Your decisions</h4>
                  <ul>
                    {review.uncertain.map((suggestion, index) => (
                      <li key={`${suggestion.questionId}:${suggestion.target.key}:${index}`}>
                        <strong>{choices[index] ? "Merge" : "Keep separate"}</strong>{" "}
                        {suggestion.sources.map(({ text }) => `“${text}”`).join(", ")} and “
                        {suggestion.target.text}”
                      </li>
                    ))}
                  </ul>
                  <button className="button small" disabled={busy} onClick={() => setChoices([])}>
                    Revisit decisions
                  </button>
                </div>
              )
            )}
            <div className="button-row">
              {!current && !!(review.clear.length || choices.some(Boolean)) && (
                <button className="button primary" disabled={busy} onClick={apply}>
                  Apply suggestions to draft
                </button>
              )}
              <button className="button" disabled={busy} onClick={() => setReview(null)}>
                Close assistant
              </button>
            </div>
          </>
        )
      )}
    </section>
  );
}
