import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { HostBuzzers, HostState } from "@naija/contracts";
import { useBuzzers } from "../hooks/useBuzzers";
export function BuzzerControls({ state: s }: { state: HostState }) {
  const { data, error, connected, busy, act } = useBuzzers<HostBuzzers>(s.id, true);
  const [invite, setInvite] = useState(false);
  const url = location.origin + "/play/" + s.id;
  return (
    <section className="control-card buzzer-controls">
      <div className="section-eyebrow">PHONE BUZZERS</div>
      <p className="host-note">
        {data?.players.filter((p) => p.approved && p.connection === "ready").length ?? 0} approved
        phones active · status updates every 5 seconds
      </p>
      <h3>
        {data?.winner
          ? `${data.winner.name} buzzed first`
          : data?.armed
            ? "Buzzers are open"
            : "Buzzers locked"}
      </h3>
      <p>
        Only the current face-off player on each team can buzz. Open after reading the question.
      </p>
      <p>
        Players join at{" "}
        <a href="/play" target="_blank" rel="noreferrer">
          {location.origin}/play
        </a>{" "}
        · Game code <strong>{s.id}</strong>. Approve their names, then put one player from each team
        on stage.
      </p>
      <div className="button-row">
        <button
          className="button primary"
          disabled={
            busy || !connected || s.paused || s.phase !== "faceoff" || s.face.first !== null
          }
          onClick={() => act({ action: data?.armed ? "lock" : "arm" })}
        >
          {data?.armed ? "Lock buzzers" : "Open buzzers"}
        </button>
        <button className="button" onClick={() => setInvite(!invite)}>
          Invite phones
        </button>
      </div>
      {invite && (
        <div className="buzzer-invite">
          <div className="qr">
            <QRCodeSVG value={url} size={160} marginSize={3} />
          </div>
          <a href={url} target="_blank" rel="noreferrer">
            Open player buzzer ↗
          </a>
          <input
            aria-label="Player buzzer link"
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
          />
          {["localhost", "127.0.0.1"].includes(location.hostname) && (
            <p>
              A phone needs a reachable network address or deployed subdomain. This localhost link
              is for this computer.
            </p>
          )}
        </div>
      )}
      <details>
        <summary>
          {data?.players.length ?? 0} phones ·{" "}
          {data?.players.filter((p) => !p.approved).length ?? 0} awaiting approval
        </summary>
        {data?.players.map((p) => (
          <div className="phone-registration" key={p.id}>
            <strong>{p.name}</strong>
            <small>
              {s.teams[p.team].name} · {p.approved ? "Approved" : "Awaiting approval"}
              {" · " +
                (p.connection === "ready"
                  ? "Screen active"
                  : p.connection === "away"
                    ? "App in background"
                    : "Offline / not responding")}
              {p.approved && p.onStage !== false && s.turns[p.team] === p.member
                ? " · On stage"
                : " · Off stage"}
            </small>
            <div className="button-row">
              {!p.approved && (
                <button
                  className="button small"
                  disabled={busy}
                  onClick={() => act({ action: "approve", playerId: p.id })}
                >
                  Approve {p.name}
                </button>
              )}
              {p.approved && (
                <button
                  className="button small"
                  disabled={busy || !connected || s.phase !== "faceoff" || s.face.first !== null}
                  onClick={() =>
                    act({
                      action:
                        p.onStage !== false && s.turns[p.team] === p.member ? "bench" : "stage",
                      playerId: p.id,
                    })
                  }
                >
                  {p.onStage !== false && s.turns[p.team] === p.member
                    ? `Take ${p.name} off stage`
                    : `Put ${p.name} on stage`}
                </button>
              )}
              <button
                className="text-button"
                disabled={busy}
                onClick={() => act({ action: "remove", playerId: p.id })}
              >
                Remove {p.name}
              </button>
            </div>
          </div>
        ))}
      </details>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
