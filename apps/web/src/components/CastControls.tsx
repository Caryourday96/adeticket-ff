import { useEffect, useState } from "react";
import { Cast } from "lucide-react";
import { api } from "../lib/api";
import { CAST_NAMESPACE, loadSender, type SenderContext } from "../lib/cast";

export function CastControls({ id }: { id: string }) {
  const [context, setContext] = useState<SenderContext | null>(null);
  const [status, setStatus] = useState("Preparing Google Cast…");
  const [device, setDevice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    let cleanup = () => {};
    void api<{ castAppId: string | null }>("/config")
      .then(async (config) => {
        if (!alive) return;
        if (!config.castAppId) {
          setStatus("TV casting is awaiting activation.");
          return;
        }
        const cast = await loadSender();
        if (!alive) return;
        cast.setOptions({
          receiverApplicationId: config.castAppId,
          autoJoinPolicy: "origin_scoped",
        });
        setContext(cast);
        const update = () => {
          const session = cast.getCurrentSession();
          setDevice(session?.getCastDevice().friendlyName ?? "");
          if (!session) {
            setStatus("Choose a Google Cast TV on the same Wi-Fi.");
            return;
          }
          setStatus("Connecting audience board…");
          void session
            .sendMessage(CAST_NAMESPACE, { type: "SHOW_ROOM", room: id })
            .then(() => {
              if (alive) setStatus("Audience room " + id + " sent to TV.");
            })
            .catch(() => {
              if (alive) setStatus("Could not send the room. Stop casting and reconnect.");
            });
        };
        cast.addEventListener("sessionstatechanged", update);
        cleanup = () => cast.removeEventListener("sessionstatechanged", update);
        update();
      })
      .catch((error) => {
        if (alive) setStatus(error.message);
      });
    return () => {
      alive = false;
      cleanup();
    };
  }, [id]);
  return (
    <section className="cast-controls" aria-label="Google Cast">
      <div className="cast-actions">
        <button
          className="button"
          disabled={!context || busy}
          onClick={async () => {
            if (!context) return;
            setBusy(true);
            try {
              await context.requestSession();
            } catch (error) {
              setStatus(
                error === "cancel"
                  ? "TV selection cancelled."
                  : "Could not connect. Check Chrome, the TV and Wi-Fi, then try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Cast size={17} />
          {busy ? "Connecting…" : device ? "Change TV" : "Cast to TV"}
        </button>
        {device && (
          <button className="button" onClick={() => context?.getCurrentSession()?.endSession(true)}>
            Stop casting
          </button>
        )}
        {device && <strong>{device}</strong>}
      </div>
      <p className="muted" role="status">
        {status}
      </p>
    </section>
  );
}
