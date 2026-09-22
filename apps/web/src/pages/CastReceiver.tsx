import { useEffect, useState } from "react";
import { Brand } from "../components/Brand";
import { Audience } from "./Audience";
import { CAST_NAMESPACE, castRoom, loadReceiver } from "../lib/cast";

export function CastReceiver() {
  const [room, setRoom] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void loadReceiver()
      .then((context) => {
        if (!alive) return;
        context.addCustomMessageListener(CAST_NAMESPACE, (event) => {
          if (!alive) return;
          const next = castRoom(event.data);
          if (next) {
            setRoom(next);
            setError("");
          }
        });
        // This is an interactive board, not a media player: quiet rounds are not idle playback.
        context.start({
          customNamespaces: { [CAST_NAMESPACE]: "JSON" },
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
  if (room) return <Audience key={room} id={room} tv />;
  return (
    <main className="entry-page">
      <Brand large />
      <h1>Ready for your game night.</h1>
      <p>Choose Cast to TV on your host dashboard.</p>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
