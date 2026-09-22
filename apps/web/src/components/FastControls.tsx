import { useEffect, useRef, useState } from "react";
import type { Command, HostState } from "@naija/contracts";
export function FastControls({
  state,
  send,
  busy,
  clockOffset = 0,
}: {
  state: HostState;
  send: (c: Command) => Promise<boolean>;
  busy: boolean;
  clockOffset?: number;
}) {
  const f = state.fast!;
  const [q, setQ] = useState(0),
    [text, setText] = useState(""),
    [now, setNow] = useState(Date.now());
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setQ(0);
    setText("");
  }, [f.player]);
  const seconds = Math.max(
    0,
    Math.ceil(
      (state.paused ? f.remaining : f.deadline ? f.deadline - (now + clockOffset) : f.remaining) /
        1000,
    ),
  );
  const question = state.fastQuestions[q],
    entries = f.entries[f.player],
    expired = f.stage === "reveal" && state.message.startsWith("Time's up");
  const nextQuestion = () => {
    for (let step = 1; step < 5; step++) {
      const index = (q + step) % 5;
      if (!entries[index]) return index;
    }
    return q;
  };
  async function record(answerId: string | null, answerText: string) {
    if (busy || !answerText.trim()) return;
    const success = await send({
      type: "fastAnswer",
      question: q,
      text: answerText,
      answerId,
      finishIfComplete: true,
    });
    if (success) {
      setQ(nextQuestion());
      setText("");
      input.current?.focus();
    }
  }
  return (
    <section className="control-card fast-desk">
      <div className="section-eyebrow">FAST MONEY · PLAYER {f.player + 1}</div>
      <h3>{state.teams[state.winner!].members[f.players[f.player]]}</h3>
      <div className={"timer " + (seconds <= 5 ? "danger" : "")}>
        {seconds}
        <small>SECONDS</small>
      </div>
      {f.stage === "ready" && (
        <>
          <p className="fast-prompt">{state.fastQuestions[0].prompt}</p>
          <p className="muted">
            Read the first question, then start. Keep the other player out of hearing.
          </p>
          <label>
            Timer duration
            <select
              aria-label="Timer duration"
              value={f.remaining / 1000}
              disabled={busy}
              onChange={(event) =>
                void send({ type: "fastDuration", seconds: Number(event.target.value) })
              }
            >
              {[...new Set([10, 15, 20, 25, 30, 45, 60, 90, 120, f.remaining / 1000])]
                .sort((a, b) => a - b)
                .map((duration) => (
                  <option key={duration} value={duration}>
                    {duration} seconds
                  </option>
                ))}
            </select>
          </label>
          <p className="muted">
            Standard timing is 20 seconds for player one and 25 for player two. Changes apply to
            this turn only.
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => send({ type: "fastClock" })}
          >
            Start {f.remaining / 1000}-second timer
          </button>
        </>
      )}
      {f.stage === "running" && (
        <>
          <nav className="fast-question-tabs" aria-label="Fast Money questions">
            {state.fastQuestions.map((question, i) => (
              <button
                key={question.id}
                className={i === q ? "selected" : ""}
                aria-label={`Question ${i + 1}${entries[i] ? ", recorded" : ""}`}
                aria-current={i === q ? "step" : undefined}
                disabled={busy}
                onClick={() => {
                  setQ(i);
                  setText(entries[i]?.text ?? "");
                }}
              >
                {i + 1}
                {entries[i] ? " ✓" : ""}
              </button>
            ))}
          </nav>
          <p className="fast-prompt">{question.prompt}</p>
          {state.rehearsal && (
            <p className="host-note">
              Simulated contestant says:{" "}
              <strong>
                {question.answers.find((a) => f.player === 0 || a.id !== f.entries[0][q]?.answerId)
                  ?.text ?? "Pass"}
              </strong>
              . Judge it below, or use Pass / next to Practice returning. For duplicate Practice,
              try player one’s answer during player two’s turn.
            </p>
          )}
          {entries[q] && (
            <p className="host-note">
              Recorded: {entries[q]!.text}. Choosing another answer replaces it.
            </p>
          )}
          <div className="fast-match-list">
            {question.answers.map((a) => (
              <button
                className="button wide"
                key={a.id}
                disabled={
                  busy || seconds === 0 || (f.player === 1 && f.entries[0][q]?.answerId === a.id)
                }
                onClick={() => record(a.id, a.text)}
              >
                <span>
                  {a.text}
                  {f.player === 1 && f.entries[0][q]?.answerId === a.id
                    ? " · Already given by player one — ask for another answer"
                    : ""}
                </span>
                <b>{a.points}</b>
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void record(null, text);
            }}
          >
            <label>
              Off-board answer · 0 points
              <input
                ref={input}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type their answer, then Enter"
                maxLength={100}
                disabled={busy || seconds === 0}
              />
            </label>
            <button className="button wide" disabled={busy || seconds === 0 || !text.trim()}>
              Record & next
            </button>
          </form>
          <div className="button-row">
            <button
              className="button"
              disabled={busy || seconds === 0}
              onClick={() => {
                setQ(nextQuestion());
                setText("");
              }}
            >
              Pass and return later
            </button>
            <button
              className="button danger-button"
              disabled={busy}
              onClick={() => send({ type: "fastEndTurn" })}
            >
              End turn & reveal
            </button>
          </div>
          <p className="muted">
            Select a match to record and advance. All five recorded or time up ends the turn
            automatically.
          </p>
          <p className="host-note">
            Passing leaves this question unanswered for now. Use the numbered tabs to return before
            the timer ends.
          </p>
          <details>
            <summary>{entries.filter(Boolean).length} / 5 answers recorded</summary>
            {entries.map((entry, i) => (
              <p key={i}>
                {i + 1}. {entry?.text ?? "Passed / unanswered"}
              </p>
            ))}
          </details>
        </>
      )}
      {f.stage === "reveal" && (
        <div className="fast-reveal-prompt" role="status">
          <h2>{expired ? "Time's up" : "Turn complete"}</h2>
          <p>
            {entries.filter(Boolean).length} of 5 answers recorded. Reveal each answer to show its
            points on the board.
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => send({ type: "fastReveal" })}
          >
            Reveal answer {f.revealed[f.player] + 1} / 5
          </button>
        </div>
      )}
      {f.stage === "between" && (
        <button
          className="button primary"
          disabled={busy}
          onClick={() => send({ type: "fastNextPlayer" })}
        >
          Bring in player two
        </button>
      )}
      {f.stage === "done" && (
        <section className="fast-results" aria-live="polite">
          <h2>Fast Money results</h2>
          {f.entries.map((row, player) => (
            <div key={player} className="host-note">
              <h3>
                {state.teams[state.winner!].members[f.players[player]]} ·{" "}
                {row.reduce((total, entry) => total + (entry?.points ?? 0), 0)} points
              </h3>
              {row.map((entry, index) => (
                <p key={index}>
                  {index + 1}. {entry?.text ?? "No answer"} — {entry?.points ?? 0} points
                </p>
              ))}
            </div>
          ))}
          <h3>
            Total: {f.entries.flat().reduce((sum, a) => sum + (a?.points ?? 0), 0)} / 200 points
          </h3>
          <p>
            {f.entries.flat().reduce((sum, a) => sum + (a?.points ?? 0), 0) >= 200
              ? "They did it! Fast Money won."
              : "A great effort. Celebrate your champions."}
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => send({ type: "finish" })}
          >
            Show final celebration
          </button>
        </section>
      )}
    </section>
  );
}
