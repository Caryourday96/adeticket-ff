import type { PublicState } from "@naija/contracts";
import { Brand } from "./Brand";
import { Trophy } from "lucide-react";
export function Board({ state, compact = false }: { state: PublicState; compact?: boolean }) {
  const winner = state.winner !== null ? state.teams[state.winner] : null;
  return (
    <div
      className={
        "stage theme-" + (state.audienceTheme?.preset ?? "classic") + (compact ? " compact" : "")
      }
    >
      <div className="stage-lights" />
      <div className="stage-top">
        <span className="stage-label">
          {state.fast
            ? "FAST MONEY"
            : state.round >= 4
              ? "SUDDEN DEATH"
              : "ROUND " + String(state.round + 1).padStart(2, "0")}
        </span>
        {state.audienceTheme?.title ? (
          <div className="event-brand">
            <strong>{state.audienceTheme.title}</strong>
            <small>{state.audienceTheme.subtitle}</small>
          </div>
        ) : (
          <Brand />
        )}
        <span className="stage-label">
          {state.fast ? "TARGET · 200" : state.multiplier + "× POINTS"}
        </span>
      </div>
      {["champion", "finished"].includes(state.phase) ? (
        <div className="winner-panel">
          <Trophy size={64} />
          <div className="section-eyebrow">YOUR CHAMPIONS</div>
          <h2>{winner?.name}</h2>
          <p>{state.winner !== null ? state.scores[state.winner] : 0} points · Well played!</p>
          {state.fast && (
            <p>
              Fast Money: {state.fast.entries.flat().reduce((sum, e) => sum + (e?.points ?? 0), 0)}{" "}
              / 200
            </p>
          )}
        </div>
      ) : state.fast ? (
        <div className="fast-board">
          <div className="section-eyebrow">FAST MONEY · PLAYER {state.fast.player + 1}</div>
          <h2>Five answers. One big finish.</h2>
          {state.fast.prompts.map((prompt, i) => (
            <div className="fast-public-row" key={prompt}>
              <span>{i + 1}</span>
              <div>
                <small>{prompt}</small>
                <div className="fast-public-answers">
                  {state.fast!.entries.map((row, p) => (
                    <strong key={p}>
                      {row[i] ? row[i]!.text : "•••••"} <b>{row[i] ? row[i]!.points : "—"}</b>
                    </strong>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <div className="fast-total">
            REVEALED POINTS{" "}
            <strong>
              {state.fast.entries.flat().reduce((sum, e) => sum + (e?.points ?? 0), 0)}
            </strong>{" "}
            / 200
          </div>
        </div>
      ) : (
        <>
          <div className="question-plaque">
            <span>{state.question.category.replace("-", " & ")}</span>
            <h2>{state.question.prompt}</h2>
          </div>
          <div className="answer-frame">
            <div className="answer-grid">
              {state.question.answers.map((a) => (
                <div
                  key={a.id}
                  className={"answer-tile " + (a.revealed ? "revealed" : "hidden-answer")}
                >
                  {a.revealed ? (
                    <>
                      <span>{a.text}</span>
                      <strong>{a.points}</strong>
                    </>
                  ) : (
                    <span className="answer-number">{a.rank}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="board-bottom">
            <div className="strikes" aria-label={state.strikes + " strikes"}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={i < state.strikes ? "lit" : ""}>
                  ✕
                </span>
              ))}
            </div>
            <div className="bank">
              <span>ROUND BANK</span>
              <strong>{state.bank}</strong>
            </div>
          </div>
        </>
      )}
      <div className="stage-scores">
        {state.teams.map((t, i) => (
          <div key={i} className={"stage-team " + (state.control === i ? "active" : "")}>
            <div>
              <small>{state.control === i ? "IN CONTROL" : "CHALLENGERS"}</small>
              <strong>{t.name}</strong>
            </div>
            <b>{state.scores[i]}</b>
          </div>
        ))}
      </div>
      {["play", "steal", "faceoff"].includes(state.phase) && (
        <div className="stage-contestant">
          AT THE MIC ·{" "}
          {(() => {
            const side =
              state.phase === "steal"
                ? state.control === 0
                  ? 1
                  : 0
                : state.phase === "faceoff"
                  ? state.face.current
                  : state.control;
            const team = state.teams[side];
            return state.phase === "faceoff" && state.face.first === null
              ? "Face-off contestants, get ready"
              : team.members[state.phase === "steal" ? team.captain : state.turns[side]];
          })()}
        </div>
      )}
      {state.paused && <div className="paused-overlay">GAME PAUSED</div>}
    </div>
  );
}
