import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { HostBuzzers, PlayerView } from "@naija/contracts";
import { api } from "../lib/api";
export function useBuzzers<T extends HostBuzzers | PlayerView>(id: string, host = false) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const sequence = useRef(0),
    alive = useRef(false),
    acting = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const next = await api<T>(`/games/${id}/${host ? "buzzers" : "player"}`);
      if (alive.current && request === sequence.current) {
        setData(next);
        setLastUpdated(Date.now());
        setError("");
      }
    } catch (e) {
      if (alive.current && request === sequence.current) setError((e as Error).message);
    }
  }, [id, host]);
  useEffect(() => {
    alive.current = true;
    const socket = io();
    socket.on("connect", () =>
      socket.emit("join", { id, role: host ? "host" : "audience" }, (r: { error?: string }) => {
        setConnected(!r.error);
        void refresh();
      }),
    );
    if (host) {
      socket.on("buzzers", (next: HostBuzzers) => {
        // The host stream already contains the full view. Supersede any older HTTP read.
        sequence.current++;
        setData(next as T);
        setLastUpdated(Date.now());
        setError("");
      });
    } else {
      // Public buzzer events cannot include this phone's private registration status.
      socket.on("buzzer", () => void refresh());
    }
    const disconnect = () => {
      sequence.current++;
      setConnected(false);
    };
    socket.on("disconnect", disconnect);
    socket.on("connect_error", disconnect);
    const poll = setInterval(() => void refresh(), 5000);
    void refresh();
    return () => {
      alive.current = false;
      sequence.current++;
      clearInterval(poll);
      socket.disconnect();
    };
  }, [id, host, refresh]);
  const playerId = !host ? (data as PlayerView | null)?.player?.id : undefined;
  useEffect(() => {
    if (!playerId || !connected) return;
    const beat = () => {
      void api(`/games/${id}/player/heartbeat`, {
        visible: document.visibilityState === "visible",
      }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, 5000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [id, playerId, connected]);
  async function act(body: unknown, path = host ? "buzzers" : "player") {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setError("");
    sequence.current++;
    try {
      await api(`/games/${id}/${path}`, body);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      acting.current = false;
      setBusy(false);
    }
  }
  return { data, error, connected, busy, act, lastUpdated };
}
