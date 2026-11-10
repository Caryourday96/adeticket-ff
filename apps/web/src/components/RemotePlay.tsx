import { useEffect, useRef, useState } from "react";
import type { HostState, PublicState, RemoteAnswer, RemoteAnswerView } from "@naija/contracts";
import { api } from "../lib/api";
import { commandId } from "../lib/commandId";

export function RemoteAnswerPanel({ state }: { state: HostState }) {
  const [view, setView] = useState<{ revision: number; answers: RemoteAnswer[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const next = await api<NonNullable<typeof view>>(`/games/${state.id}/answers`);
        if (alive) {
          setView(next);
          setError("");
        }
      } catch (e) {
        if (alive) {
          setView(null);
          setError((e as Error).message);
        }
      }
    };
    void refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [state.id, state.revision]);
  const answers = view?.revision === state.revision ? view.answers : [];
  return (
    <section className="control-card" aria-label="Remote answers">
      <div className="section-eyebrow">PRIVATE PLAYER ANSWERS</div>
      <h3>Answers from phones</h3>
      <p className="host-note">
        Read the guess, then select its match or mark a miss using the game controls. Sending a
        guess never changes the score.
      </p>
      {answers.length ? (
        answers.map((answer) => (
          <div key={answer.id} className="host-note">
            <strong>
              {answer.name} · {state.teams[answer.team].name}
            </strong>
            <p style={{ overflowWrap: "anywhere" }}>{answer.text}</p>
          </div>
        ))
      ) : (
        <p className="muted">No typed answer for the current turn. Spoken answers still work.</p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}

export function PlayerAnswer({ state, connected }: { state: PublicState; connected: boolean }) {
  const [view, setView] = useState<RemoteAnswerView | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<{ id: string; revision: number; text: string } | null>(null);
  const sending = useRef(false);
  const turn = `${state.id}:${state.answerTurnRevision ?? state.revision}`;
  useEffect(() => {
    setText("");
    setError("");
    pending.current = null;
  }, [turn]);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const next = await api<RemoteAnswerView>(`/games/${state.id}/player/answer`);
        if (alive) {
          setView(next);
          setError("");
        }
      } catch (e) {
        if (alive) {
          setView(null);
          setError((e as Error).message);
        }
      }
    };
    setView(null);
    void refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [state.id, state.revision]);
  const current = view?.revision === state.revision ? view : null;
  return (
    <section className="entry-card" aria-label="Send an answer">
      <h2>Your answer</h2>
      {current?.submission ? (
        <div role="status">
          <strong>Sent to the host</strong>
          <p style={{ overflowWrap: "anywhere" }}>{current.submission.text}</p>
          <p className="muted">
            Wait for the host to judge it. No points have been awarded automatically.
          </p>
        </div>
      ) : current?.eligible ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (sending.current || !text.trim() || !connected) return;
            sending.current = true;
            setBusy(true);
            setError("");
            const request =
              pending.current &&
              pending.current.revision === state.revision &&
              pending.current.text === text.trim()
                ? pending.current
                : { id: commandId(), revision: state.revision, text: text.trim() };
            pending.current = request;
            try {
              const answer = await api<RemoteAnswer>(`/games/${state.id}/player/answer`, request);
              setView((old) =>
                old?.revision === answer.revision ? { ...old, submission: answer } : old,
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              sending.current = false;
              setBusy(false);
            }
          }}
        >
          <label>
            Type your guess
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
              required
              autoComplete="off"
              disabled={busy}
            />
          </label>
          <button className="button primary wide" disabled={busy || !connected || !text.trim()}>
            {busy ? "Sending…" : "Send answer to host"}
          </button>
          <p className="muted">
            Only the host sees your guess. Check it before sending; one guess is accepted per
            current turn.
          </p>
        </form>
      ) : (
        <p>{current?.reason ?? "Checking your answer turn…"}</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function PlayerBoard({ state }: { state: PublicState }) {
  return (
    <section className="entry-card" aria-label="Live game board">
      <div className="section-eyebrow">LIVE SCOREBOARD</div>
      {state.teams.map((team, side) => (
        <p key={side} style={{ overflowWrap: "anywhere" }}>
          <strong>{team.name}</strong> · {state.scores[side]} points
        </p>
      ))}
      <p>
        Round {state.round + 1} · {state.strikes} of 3 strikes
      </p>
      {!state.fast && (
        <>
          <h2 style={{ overflowWrap: "anywhere" }}>{state.question.prompt}</h2>
          <ol>
            {state.question.answers.map((answer) => (
              <li key={answer.rank} style={{ overflowWrap: "anywhere" }}>
                {answer.revealed ? `${answer.text} · ${answer.points} points` : "Hidden answer"}
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="muted">{state.message}</p>
    </section>
  );
}
