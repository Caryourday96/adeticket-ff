import { useEffect, useRef, useState } from "react";
export function KeepAwake() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    let lock: WakeLockSentinel | null = null;
    let requesting = false;
    const release = () => {
      if (lock) {
        void lock.release().catch(() => {});
        lock = null;
      }
    };
    async function acquire() {
      if (!enabled || document.visibilityState !== "visible" || lock || requesting) return;
      if (!navigator.wakeLock) {
        setMessage(
          "Not supported in this browser. Adjust your device's auto-lock setting if needed.",
        );
        return;
      }
      requesting = true;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (generation.current !== current || document.visibilityState !== "visible") {
          await next.release();
          return;
        }
        lock = next;
        setMessage("Screen stays awake while this page is visible.");
        next.addEventListener("release", () => {
          if (generation.current === current) {
            lock = null;
            setMessage("Screen wake lock released by the device. Toggle off and on to retry.");
          }
        });
      } catch {
        if (generation.current === current)
          setMessage("Could not keep the screen awake. Check battery settings or try again.");
      } finally {
        requesting = false;
      }
    }
    function visibility() {
      if (document.visibilityState !== "visible") {
        release();
        setMessage("Paused while this page is hidden.");
      } else void acquire();
    }
    if (enabled) void acquire();
    else setMessage("");
    document.addEventListener("visibilitychange", visibility);
    return () => {
      generation.current++;
      document.removeEventListener("visibilitychange", visibility);
      release();
    };
  }, [enabled]);
  return (
    <div className="keep-awake">
      <label>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Keep screen awake
      </label>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
