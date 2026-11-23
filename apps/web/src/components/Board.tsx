import type { PublicState, Side } from "@naija/contracts";
import { Brand } from "./Brand";
import { Trophy } from "lucide-react";

function answeringPlayer(state: PublicState): { team: Side; member: number } | null {
  if (state.lobby || state.paused) return null;
  if (state.phase === "play") return { team: state.control, member: state.turns[state.control] };
  if (state.phase === "steal") {
    const team = state.control === 0 ? 1 : 0;
    return { team, member: state.teams[team].captain };
  }
  if (state.phase === "faceoff" && state.face.first !== null) {
    const team = state.face.current;
    return { team, member: state.turns[team] };
  }
  if (state.phase === "fast" && state.fast && state.winner !== null) {
    if (state.fast.stage === "between")
      return { team: state.winner, member: state.fast.players[1] };
    if (state.fast.stage === "ready" || state.fast.stage === "running")
      return { team: state.winner, member: state.fast.players[state.fast.player] };
  }
  return null;
}

export function Board({ state, compact = false }: { state: PublicState; compact?: boolean }) {
  const winner = state.winner !== null ? state.teams[state.winner] : null;
  const answering = answeringPlayer(state);
  const activeTeam = answering ? state.teams[answering.team] : null;
  const speaker =
    answering && !activeTeam?.awaitingPlayers ? activeTeam?.members[answering.member] : null;
  const waitingForFaceOff =
    !state.lobby && !state.paused && state.phase === "faceoff" && state.face.first === null;
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
          {winner && <Trophy size={64} />}
          <div className="section-eyebrow">{winner ? "YOUR CHAMPIONS" : "GAME ENDED"}</div>
          <h2>{winner?.name ?? "Thanks for playing"}</h2>
          <p>
            {state.winner !== null
              ? `${state.scores[state.winner]} points · Well played!`
              : "No champion declared. Final scores are shown below."}
          </p>
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
                      <span>
                        #{a.rank} · {a.text}
                      </span>
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
        {state.teams.map((t, i) => {
          const hasControl =
            !state.lobby &&
            state.control === i &&
            (state.phase === "play" || state.phase === "choice");
          const isStealing = state.phase === "steal" && state.control !== i;
          return (
            <div
              key={i}
              className={
                "stage-team " + (hasControl || isStealing || answering?.team === i ? "active" : "")
              }
              role="group"
              aria-label={t.name}
            >
              <div>
                {hasControl && (
                  <small>{state.phase === "choice" ? "PLAY OR PASS" : "IN CONTROL"}</small>
                )}
                {isStealing && <small>STEAL CHANCE</small>}
                <strong>{t.name}</strong>
                {t.awaitingPlayers ? (
                  <p className="stage-roster-empty">Waiting for players</p>
                ) : (
                  <ul className="stage-roster" aria-label={`${t.name} players`}>
                    {t.members.map((name, member) => {
                      const isAnswering = answering?.team === i && answering.member === member;
                      const isFaceOff = waitingForFaceOff && state.turns[i] === member;
                      return (
                        <li key={member} className={isAnswering ? "stage-roster-next" : ""}>
                          <span>{name}</span>
                          {isAnswering && <span className="stage-roster-role">Next to answer</span>}
                          {isFaceOff && <span className="stage-roster-role">Face-off</span>}
                          {member === t.captain && (
                            <span className="stage-roster-role">Team captain</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <b>{state.scores[i]}</b>
            </div>
          );
        })}
      </div>
      {!compact && (
        <div className="stage-turn-announcement" role="status">
          {speaker ? `Next to answer: ${speaker} from ${activeTeam?.name}` : ""}
        </div>
      )}
      {state.paused && <div className="paused-overlay">GAME PAUSED</div>}
    </div>
  );
}
