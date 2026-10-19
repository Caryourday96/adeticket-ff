import { KeepAwake } from "../components/KeepAwake";
import { useEffect, useState } from "react";
import { Maximize, Radio } from "lucide-react";
import type { PublicState } from "@naija/contracts";
import { useGame } from "../hooks/useGame";
import { AudienceAudio } from "../components/AudienceAudio";
import { Board } from "../components/Board";
import { AlphaNotice } from "../components/AlphaNotice";
import { QRCodeSVG } from "qrcode.react";
import { gameOrigin } from "../lib/links";
export function Audience({ id, tv = false }: { id: string; tv?: boolean }) {
  const { state, connected, error, clockOffset } = useGame<PublicState>(id, "audience"),
    [now, setNow] = useState(Date.now());
  const [fullscreenError, setFullscreenError] = useState("");
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  return (
    <main className="audience-page">
      <AudienceAudio state={state} connected={connected} tv={tv} now={now + clockOffset} />
      <AlphaNotice />
      <aside className="audience-join" aria-label="Join this game">
        <QRCodeSVG
          value={`${gameOrigin()}/play/${id}`}
          size={140}
          marginSize={4}
          title="Scan to join this game"
        />
        <div>
          <strong>Scan to play</strong>
          <b>{id}</b>
          <small>
            {state?.joinsLocked
              ? "New joins paused by host"
              : "Choose your team and enter your name"}
          </small>
        </div>
      </aside>
      <header>
        <span>
          <Radio size={14} />
          {state?.rehearsal ? "REHEARSAL · " : ""}
          {connected ? "LIVE" : "CONNECTING"} · {id}
        </span>
        {!tv && (
          <button
            className="button small"
            onClick={async () => {
              setFullscreenError("");
              try {
                if (!document.fullscreenElement) {
                  if (!document.documentElement.requestFullscreen) throw new Error("unsupported");
                  await document.documentElement.requestFullscreen();
                } else await document.exitFullscreen();
              } catch {
                setFullscreenError(
                  "Fullscreen is unavailable or blocked. Use your browser's fullscreen controls, or continue in this window.",
                );
              }
            }}
          >
            <Maximize size={15} />
            Fullscreen
          </button>
        )}
      </header>
      {fullscreenError && <p role="alert">{fullscreenError}</p>}
      {state ? (
        <>
          <Board state={state} />
          {state.fast && (
            <div className="audience-timer">
              {Math.max(
                0,
                Math.ceil(
                  (state.paused
                    ? state.fast.remaining
                    : state.fast.deadline
                      ? state.fast.deadline - (now + clockOffset)
                      : state.fast.stage === "ready"
                        ? state.fast.remaining
                        : 0) / 1000,
                ),
              )}
              <small>SECONDS</small>
            </div>
          )}
          <div className="audience-message" aria-live="polite">
            {state.message}
          </div>
        </>
      ) : (
        <div className="loading">
          <h1>Getting your board ready…</h1>
          {error && <p role="alert">{error}</p>}
          <a href="/join">Try another room</a>
        </div>
      )}
      {!tv && <KeepAwake />}
      <footer>Sample game points · Nigerian-inspired home game</footer>
    </main>
  );
}
