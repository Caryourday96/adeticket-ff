import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
    googlefc?: {
      callbackQueue?: Array<() => void>;
      showRevocationMessage?: () => void;
    };
  }
}

export function Advertisement() {
  const client = document.querySelector<HTMLMetaElement>(
    'meta[name="advertising-client"]',
  )?.content;
  const slot = document.querySelector<HTMLMetaElement>('meta[name="advertising-slot"]')?.content;
  const unit = useRef<HTMLModElement>(null);
  const requested = useRef(false);
  const [failed, setFailed] = useState(false);
  const configured = /^ca-pub-\d{16}$/.test(client ?? "") && /^\d{10}$/.test(slot ?? "");
  useEffect(() => {
    if (!configured || !unit.current || location.pathname.replace(/\/$/, "") !== "/rules") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || requested.current) return;
      requested.current = true;
      observer.disconnect();
      let script = document.getElementById("adsense-loader") as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "adsense-loader";
        script.async = true;
        script.crossOrigin = "anonymous";
        script.nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ?? "";
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
        script.onerror = () => setFailed(true);
        document.head.appendChild(script);
      }
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        setFailed(true);
      }
    });
    observer.observe(unit.current);
    return () => observer.disconnect();
  }, [client, configured]);
  if (!configured || failed) return null;
  return (
    <aside className="advertisement" aria-label="Advertisement">
      <small>Advertisement</small>
      <ins
        ref={unit}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      <div className="advertisement-footer">
        <a href="/privacy">Privacy and advertising</a>
        <button
          type="button"
          className="privacy-reopen-button"
          onClick={() => {
            const fc = window.googlefc;
            if (fc?.callbackQueue && typeof fc.showRevocationMessage === "function") {
              fc.callbackQueue.push(fc.showRevocationMessage);
            } else if (typeof fc?.showRevocationMessage === "function") {
              fc.showRevocationMessage();
            }
          }}
        >
          Privacy and cookie settings
        </button>
      </div>
    </aside>
  );
}
