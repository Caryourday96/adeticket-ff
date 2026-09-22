import { useState } from "react";
import type { PlayerView, PublicState, Side } from "@naija/contracts";
import { Brand } from "../components/Brand";
import { useGame } from "../hooks/useGame";
import { useBuzzers } from "../hooks/useBuzzers";
import { AlphaNotice } from "../components/AlphaNotice";
export function Player({ id }: { id: string }) {
  const {
    state: s,
    error: gameError,
    connected: gameConnected,
  } = useGame<PublicState>(id, "audience");
  const { data, error, connected, busy, act } = useBuzzers<PlayerView>(id);
  const [team, setTeam] = useState<Side>(0),
    [name, setName] = useState("");
  const p = data?.player,
    b = data?.buzzer;
  const eligible =
    !!p &&
    p.onStage !== false &&
    !!s &&
    s.turns[p.team] === p.member &&
    s.teams[p.team].members[p.member] === p.name;
  const ready =
    connected &&
    gameConnected &&
    p?.approved &&
    eligible &&
    b?.armed &&
    !s?.paused &&
    s?.phase === "faceoff" &&
    s.face.first === null;
  return (
    <main className="phone-page">
      <Brand />
      <AlphaNotice />
      <div className="eyebrow">PLAYER BUZZER · ROOM {id}</div>
      {!s || !data ? (
        <p>Connecting to the game…</p>
      ) : !p ? (
        <section className="entry-card">
          <h1>Take your place.</h1>
          <p>
            Enter your name and select your team. Your host will approve you and choose who goes on
            stage.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act({ team, name });
            }}
          >
            <label>
              Team
              <select
                aria-label="Team"
                value={team}
                onChange={(e) => {
                  setTeam(Number(e.target.value) as Side);
                }}
              >
                {s.teams.map((t, i) => (
                  <option key={i} value={i}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                autoComplete="given-name"
              />
            </label>
            <button
              className="button primary wide"
              disabled={
                busy || !connected || !name.trim() || ["fast", "finished"].includes(s.phase)
              }
            >
              Join game
            </button>
          </form>
        </section>
      ) : (
        <>
          <div className="phone-identity">
            <h1>{p.name}</h1>
            <p>{s.teams[p.team].name}</p>
          </div>
          <div className="phone-status" aria-live="polite">
            {!connected || !gameConnected
              ? "Reconnecting — buzzer disabled"
              : !p.approved
                ? "Waiting for host approval"
                : s.paused
                  ? "Game paused"
                  : b?.winner
                    ? `${b.winner.name} · ${s.teams[b.winner.team].name} buzzed first`
                    : !eligible
                      ? "Waiting for the host to put you on stage"
                      : ready
                        ? "You're live. Get ready!"
                        : "Wait for the host to open buzzers"}
          </div>
          <ul className="phone-readiness" aria-label="Buzzer readiness checklist">
            <li className={connected && gameConnected ? "done" : ""}>Phone connected</li>
            <li className={p.approved ? "done" : ""}>Host approval</li>
            <li className={eligible ? "done" : ""}>On-stage assignment</li>
            <li className={b?.armed ? "done" : ""}>Host opened buzzers</li>
          </ul>
          <button
            className={"phone-buzzer " + (ready ? "ready" : "")}
            disabled={!ready || busy}
            onClick={() => {
              navigator.vibrate?.(35);
              void act({ epoch: b!.epoch }, "player/buzz");
            }}
          >
            <span>
              {b?.winner?.team === p.team && b.winner.name === p.name
                ? "FIRST!"
                : ready
                  ? "BUZZ"
                  : "WAIT"}
            </span>
            <small>{ready ? "TAP TO ANSWER" : "LISTEN TO YOUR HOST"}</small>
          </button>
          <p className="muted">
            Keep this screen open. The first buzz received by the server wins.
          </p>
        </>
      )}
      {(error || gameError) && (
        <p role="alert" className="error">
          {error || gameError}
        </p>
      )}
      <a href={"/audience/" + id}>Watch the audience board →</a>
    </main>
  );
}
