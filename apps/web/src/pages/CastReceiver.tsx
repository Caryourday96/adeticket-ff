import { useEffect, useRef, useState } from "react";
import { Brand } from "../components/Brand";
import { Audience } from "./Audience";
import { CAST_NAMESPACE, castRoom, loadReceiver, type ReceiverContext } from "../lib/cast";
import {
  CAST_NAMESPACE as BIBLE_NAMESPACE,
  DISPLAY_ORIGIN,
  castRoomMessage,
  castDisplayUrl,
  displayStatusMessage,
  type CastRoomMessage,
} from "bible-blitz/cast";

export function CastReceiver() {
  const [selection, setSelection] = useState<
    | { game: "feud"; room: string }
    | { game: "bible"; message: CastRoomMessage; senderId: string }
    | null
  >(null);
  const [error, setError] = useState("");
  const receiver = useRef<ReceiverContext | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let alive = true;
    void loadReceiver()
      .then((context) => {
        if (!alive) return;
        receiver.current = context;
        context.addCustomMessageListener(CAST_NAMESPACE, (event) => {
          if (!alive) return;
          const next = castRoom(event.data);
          if (next) {
            setSelection({ game: "feud", room: next });
            setError("");
          }
        });
        context.addCustomMessageListener(BIBLE_NAMESPACE, (event) => {
          if (!alive) return;
          const message = castRoomMessage(event.data);
          if (!message) return;
          setSelection({ game: "bible", message, senderId: event.senderId });
          setError("");
        });
        // This is an interactive board, not a media player: quiet rounds are not idle playback.
        context.start({
          customNamespaces: { [CAST_NAMESPACE]: "JSON", [BIBLE_NAMESPACE]: "JSON" },
          disableIdleTimeout: true,
          skipPlayersLoad: true,
        });
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (selection?.game !== "bible") return;
    const forward = (event: MessageEvent) => {
      if (event.origin !== DISPLAY_ORIGIN || event.source !== frame.current?.contentWindow) return;
      const status = displayStatusMessage(event.data);
      if (
        !status ||
        status.room !== selection.message.room ||
        status.requestId !== selection.message.requestId
      )
        return;
      try {
        receiver.current?.sendCustomMessage(BIBLE_NAMESPACE, selection.senderId, status);
      } catch {
        /* The sender may already have disconnected; the TV keeps its public board. */
      }
    };
    window.addEventListener("message", forward);
    return () => window.removeEventListener("message", forward);
  }, [selection]);
  if (selection?.game === "feud") return <Audience key={selection.room} id={selection.room} tv />;
  if (selection?.game === "bible")
    return (
      <iframe
        ref={frame}
        key={selection.message.requestId}
        title="Bible Blitz TV display"
        className="bible-cast-frame"
        src={castDisplayUrl(selection.message)}
        sandbox="allow-scripts allow-same-origin"
        allow="autoplay"
        referrerPolicy="no-referrer"
      />
    );
  return (
    <main className="entry-page">
      <Brand large />
      <h1>Ready for your game night.</h1>
      <p>Choose Cast to TV in Friends Showdown or Bible Blitz.</p>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
