import { useEffect, useRef, useState } from "react";
import type { PublicState } from "@naija/contracts";
import { GameAudio, soundCue } from "../lib/sounds";

export function AudienceAudio({
  state,
  connected,
  tv,
  now,
}: {
  state: PublicState | null;
  connected: boolean;
  tv: boolean;
  now: number;
}) {
  const audio = useRef<GameAudio | null>(null);
  const previous = useRef<PublicState | null>(null);
  const previousTime = useRef<number | null>(null);
  const localExpiryAt = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false),
    [volume, setVolume] = useState(0.6);
  const [error, setError] = useState("");
  const hostAllowsSound = state?.audienceSoundEnabled !== false;
  useEffect(() => {
    const player = new GameAudio();
    audio.current = player;
    let alive = true;
    if (tv)
      void player
        .enable()
        .then(() => {
          if (alive) setEnabled(true);
        })
        .catch(() => {
          if (alive)
            setError("TV sound is blocked by this device. The board will continue silently.");
        });
    return () => {
      alive = false;
      player.close();
    };
  }, [tv]);
  useEffect(() => {
    const cue = state && connected ? soundCue(previous.current, state) : null;
    previous.current = connected ? state : null;
    const duplicateLocalExpiry =
      cue === "time" && localExpiryAt.current !== null && Date.now() - localExpiryAt.current < 1500;
    if (
      cue &&
      !duplicateLocalExpiry &&
      enabled &&
      hostAllowsSound &&
      !audio.current?.play(cue, volume)
    )
      setError("Sound paused by browser. Press Test sound to resume.");
  }, [state, connected, enabled, volume, hostAllowsSound]);
  useEffect(() => {
    const fast = state?.fast;
    const remaining =
      connected && !state?.paused && fast?.stage === "running" && fast.deadline
        ? Math.max(0, fast.deadline - now)
        : null;
    if (
      remaining === 0 &&
      previousTime.current !== null &&
      previousTime.current > 0 &&
      enabled &&
      hostAllowsSound
    ) {
      localExpiryAt.current = Date.now();
      audio.current?.play("time", volume);
    }
    previousTime.current = remaining;
  }, [state, connected, now, enabled, volume, hostAllowsSound]);
  return (
    <div className="audience-audio" aria-label="Audience sound controls">
      {!tv && (
        <>
          <button
            className="button small"
            onClick={async () => {
              if (enabled) {
                setEnabled(false);
                return;
              }
              try {
                await audio.current?.enable();
                setEnabled(true);
                setError("");
              } catch {
                setError("Could not enable audio. Check browser sound permissions.");
              }
            }}
          >
            {enabled ? "Mute audience" : "Enable audience sound"}
          </button>
          <button
            className="button small"
            onClick={async () => {
              try {
                await audio.current?.enable();
                setEnabled(true);
                audio.current?.play("reveal", volume);
                setError("");
              } catch {
                setError("Could not play audio. Check browser sound permissions.");
              }
            }}
          >
            Test sound
          </button>
          <label>
            Volume{" "}
            <input
              aria-label="Audience volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </label>
        </>
      )}
      {!hostAllowsSound && <span role="status">Audience sound is muted by the host.</span>}
      {error && <span role="status">{error}</span>}
    </div>
  );
}
