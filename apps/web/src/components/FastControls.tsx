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
    entries = f.entries[f.player];
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
          <button
            className="button primary"
            disabled={busy}
            onClick={() => send({ type: "fastClock" })}
          >
            Start {f.player === 0 ? 20 : 25}-second timer
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
                disabled={busy || seconds === 0}
                onClick={() => record(a.id, a.text)}
              >
                <span>{a.text}</span>
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
              Pass / next
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
        <button
          className="button primary"
          disabled={busy}
          onClick={() => send({ type: "fastReveal" })}
        >
          Reveal answer {f.revealed[f.player] + 1} / 5
        </button>
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
        <>
          <h3>{f.entries.flat().reduce((sum, a) => sum + (a?.points ?? 0), 0)} / 200 points</h3>
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
        </>
      )}
    </section>
  );
}
