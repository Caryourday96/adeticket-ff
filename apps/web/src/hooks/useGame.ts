import { useCallback, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import type { Command, HostState, PublicState } from "@naija/contracts";
import { api } from "../lib/api";
import { commandId } from "../lib/commandId";
export function useGame<T extends HostState | PublicState>(id: string, role: "host" | "audience") {
  const sending = useRef(false);
  const [clockOffset, setClockOffset] = useState(0);
  useEffect(() => {
    let alive = true;
    async function sync() {
      const start = Date.now();
      try {
        const clock = await api<{ now: number }>("/clock");
        if (alive) setClockOffset(clock.now - (start + Date.now()) / 2);
      } catch {}
    }
    void sync();
    const timer = setInterval(sync, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  const [state, setState] = useState<T | null>(null),
    [connected, setConnected] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    api<T>("/games/" + id + "/" + role)
      .then((s) => alive && setState((old) => (!old || s.revision >= old.revision ? s : old)))
      .catch((e) => alive && setError(e.message));
    const socket = io({ autoConnect: false });
    socket.on("connect", () =>
      socket.emit("join", { id, role }, (result: { error?: string }) => {
        setConnected(!result.error);
        if (result.error) setError(result.error);
      }),
    );
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("state", (s: T) => {
      setState((previous) => (!previous || s.revision >= previous.revision ? s : previous));
      setError("");
    });
    socket.connect();
    return () => {
      alive = false;
      socket.disconnect();
    };
  }, [id, role]);
  const send = useCallback(
    async (command: Command) => {
      if (!state || sending.current) return false;
      sending.current = true;
      setBusy(true);
      setError("");
      try {
        const next = await api<T>("/games/" + id + "/commands", {
          id: commandId(),
          revision: state.revision,
          command,
        });
        setState((old) => (!old || next.revision >= old.revision ? next : old));
        return true;
      } catch (e) {
        setError((e as Error).message);
        try {
          const latest = await api<T>("/games/" + id + "/" + role);
          setState((old) => (!old || latest.revision >= old.revision ? latest : old));
        } catch {}
        return false;
      } finally {
        setBusy(false);
        sending.current = false;
      }
    },
    [id, role, state, busy],
  );
  return { state, connected, error, setError, busy, send, clockOffset };
}
