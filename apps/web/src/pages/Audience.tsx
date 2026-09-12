import { useEffect, useState } from "react";
import { Maximize, Radio } from "lucide-react";
import type { PublicState } from "@naija/contracts";
import { useGame } from "../hooks/useGame";
import { Board } from "../components/Board";
export function Audience({ id, tv = false }: { id: string; tv?: boolean }) {
  const { state, connected, error, clockOffset } = useGame<PublicState>(id, "audience"),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  return (
    <main className={"audience-page" + (tv ? " tv-audience" : "")}>
      <header>
        <span>
          <Radio size={14} />
          {connected ? "LIVE" : "CONNECTING"} · {id}
        </span>
        {!tv && (
          <button
            className="button small"
            onClick={() => {
              if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
              else void document.exitFullscreen();
            }}
          >
            <Maximize size={15} />
            Fullscreen
          </button>
        )}
      </header>
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
      <footer>Sample game points · Nigerian-inspired home game</footer>
    </main>
  );
}
