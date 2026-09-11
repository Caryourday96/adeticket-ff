import { useState } from "react";
import type { PlayerView, PublicState, Side } from "@naija/contracts";
import { Brand } from "../components/Brand";
import { useGame } from "../hooks/useGame";
import { useBuzzers } from "../hooks/useBuzzers";
export function Player({ id }: { id: string }) {
  const { state: s } = useGame<PublicState>(id, "audience");
  const { data, error, connected, busy, act } = useBuzzers<PlayerView>(id);
  const [team, setTeam] = useState<Side>(0),
    [member, setMember] = useState(0);
  const p = data?.player,
    b = data?.buzzer;
  const eligible =
    !!p && !!s && s.turns[p.team] === p.member && s.teams[p.team].members[p.member] === p.name;
  const ready =
    connected &&
    p?.approved &&
    eligible &&
    b?.armed &&
    !s?.paused &&
    s?.phase === "faceoff" &&
    s.face.first === null;
  return (
    <main className="phone-page">
      <Brand />
      <div className="eyebrow">PLAYER BUZZER · ROOM {id}</div>
      {!s || !data ? (
        <p>Connecting to the game…</p>
      ) : !p ? (
        <section className="entry-card">
          <h1>Take your place.</h1>
          <p>Choose your name. Your host will approve this phone.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act({ team, member });
            }}
          >
            <label>
              Team
              <select
                value={team}
                onChange={(e) => {
                  setTeam(Number(e.target.value) as Side);
                  setMember(0);
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
              <select value={member} onChange={(e) => setMember(Number(e.target.value))}>
                {s.teams[team].members.map((m, i) => (
                  <option key={i} value={i}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary wide" disabled={busy || !connected}>
              Request buzzer
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
            {!connected
              ? "Reconnecting — buzzer disabled"
              : !p.approved
                ? "Waiting for host approval"
                : s.paused
                  ? "Game paused"
                  : b?.winner
                    ? `${b.winner.name} · ${s.teams[b.winner.team].name} buzzed first`
                    : !eligible
                      ? "Your teammate is at the face-off"
                      : ready
                        ? "You're live. Get ready!"
                        : "Wait for the host to open buzzers"}
          </div>
          <button
            className={"phone-buzzer " + (ready ? "ready" : "")}
            disabled={!ready || busy}
            onClick={() => {
              navigator.vibrate?.(35);
              void act({ epoch: b!.epoch }, "player/buzz");
            }}
          >
            <span>{b?.winner?.team === p.team ? "FIRST!" : ready ? "BUZZ" : "WAIT"}</span>
            <small>{ready ? "TAP TO ANSWER" : "LISTEN TO YOUR HOST"}</small>
          </button>
          <p className="muted">
            Keep this screen open. The first buzz received by the server wins.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <a href={"/audience/" + id}>Watch the audience board →</a>
    </main>
  );
}
