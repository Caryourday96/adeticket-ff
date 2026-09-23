import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Command, HostBuzzers, HostState } from "@naija/contracts";
import { useBuzzers } from "../hooks/useBuzzers";
import { phoneStatus } from "../lib/phoneStatus";
import { api } from "../lib/api";
import { CAST_STATUS_EVENT, type CastStatusDetail } from "../lib/cast";
import { gameOrigin } from "../lib/links";
export function BuzzerControls({
  state: s,
  send,
}: {
  state: HostState;
  send: (c: Command) => Promise<boolean>;
}) {
  const { data, error, connected, busy, act, lastUpdated } = useBuzzers<HostBuzzers>(s.id, true);
  const [invite, setInvite] = useState(false),
    [handoffCopied, setHandoffCopied] = useState(false);
  const [diagnostics, setDiagnostics] = useState<{
    revision: number;
    phase: string;
    hostConnections: number;
    audienceConnections: number;
    registeredPlayers: number;
    approvedPlayers: number;
    serverTime: number;
  } | null>(null);
  const [castStatus, setCastStatus] = useState<CastStatusDetail>({
    status: "Cast has not been opened on this host yet.",
    device: "",
  });
  const url = gameOrigin() + "/play/" + s.id;
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      void api<NonNullable<typeof diagnostics>>(`/games/${s.id}/diagnostics`)
        .then((next) => alive && setDiagnostics(next))
        .catch(() => alive && setDiagnostics(null));
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [s.id]);
  useEffect(() => {
    const receive = (event: Event) =>
      setCastStatus((event as CustomEvent<CastStatusDetail>).detail);
    window.addEventListener(CAST_STATUS_EVENT, receive);
    return () => window.removeEventListener(CAST_STATUS_EVENT, receive);
  }, []);
  return (
    <section className="control-card buzzer-controls">
      <div className="section-eyebrow">PHONE BUZZERS</div>
      <div className="phone-health" aria-label="Player connection panel">
        <h3>Player connections</h3>
        {!connected || error ? (
          <p role="status">Connection status unavailable — reconnecting to the game.</p>
        ) : !data ? (
          <p>Checking phones…</p>
        ) : (
          <>
            <p className="phone-health-counts">
              <span>{data.players.filter((p) => p.connection === "ready").length} active</span>
              <span>
                {data.players.filter((p) => p.connection === "away").length} in background
              </span>
              <span>{data.players.filter((p) => p.connection === "offline").length} offline</span>
              <span>{data.players.filter((p) => !p.approved).length} awaiting approval</span>
            </p>
          </>
        )}
        {data &&
          phoneStatus(s, data, connected && !error).map((p) => (
            <div key={p.team} className={"phone-stage-status " + (p.ready ? "can-buzz" : "")}>
              <strong>
                {s.teams[p.team].name} · {p.name}
              </strong>
              <span>{p.message}</span>
            </div>
          ))}
        <small>
          Status refreshes every 5 seconds. A phone is marked offline after 15 seconds without a
          heartbeat.
        </small>
      </div>
      <p className="host-note">
        {data?.players.filter((p) => p.approved && p.connection === "ready").length ?? 0} approved
        phones active · status updates every 5 seconds
      </p>
      <div className="button-row">
        <button
          className="button small"
          disabled={busy || s.phase === "fast" || s.phase === "finished"}
          onClick={() => void send({ type: "setJoinLock", locked: !s.joinsLocked })}
        >
          {s.joinsLocked ? "Allow new joins" : "Lock new joins"}
        </button>
        <button
          className="button small"
          disabled={busy}
          onClick={() =>
            void send({ type: "audienceSound", enabled: s.audienceSoundEnabled === false })
          }
        >
          {s.audienceSoundEnabled === false ? "Enable audience sound" : "Mute audience sound"}
        </button>
      </div>
      <details className="host-diagnostics">
        <summary>Host diagnostics</summary>
        <p>
          Game revision: <strong>{s.revision}</strong> · Buzzer stream:{" "}
          <strong>{connected ? "connected" : "reconnecting"}</strong>
          {lastUpdated ? ` · Last phone update ${new Date(lastUpdated).toLocaleTimeString()}` : ""}
        </p>
        {diagnostics && (
          <p>
            Host sockets: {diagnostics.hostConnections} · Audience screens:{" "}
            {diagnostics.audienceConnections} · Registered players: {diagnostics.registeredPlayers}{" "}
            ({diagnostics.approvedPlayers} approved)
          </p>
        )}
        <p>
          Cast: <strong>{castStatus.device || castStatus.status}</strong>
          {castStatus.device ? ` · ${castStatus.status}` : ""}
        </p>
        {diagnostics && (
          <p>
            Server responded at {new Date(diagnostics.serverTime).toLocaleTimeString()} · checked
            just now
          </p>
        )}
        <p className="muted">
          Keep one host desk open. If the connection drops, wait for the reconnect banner or refresh
          server state before judging the next answer.
        </p>
        <button
          className="button small"
          onClick={() => {
            void navigator.clipboard
              .writeText(`${gameOrigin()}/host/${s.id}`)
              .then(() => {
                setHandoffCopied(true);
                setTimeout(() => setHandoffCopied(false), 2000);
              })
              .catch(() => setHandoffCopied(false));
          }}
        >
          {handoffCopied ? "Host link copied" : "Copy trusted host handoff link"}
        </button>
        <p className="muted">
          After the second device signs in as host, wait for this connection count to rise. Avoid
          judging from both devices at once.
        </p>
      </details>
      {data?.players.length ? (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Remove every registered player phone from this game?"))
              void act({ action: "removeAll" });
          }}
        >
          Remove all player phones
        </button>
      ) : null}
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
          {gameOrigin()}/play
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
