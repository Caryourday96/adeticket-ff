export const CAST_NAMESPACE = "urn:x-cast:com.naijafeud.audience";
export function castRoom(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const message = input as { type?: unknown; room?: unknown };
  return message.type === "SHOW_ROOM" &&
    typeof message.room === "string" &&
    /^[A-F0-9]{6}$/.test(message.room)
    ? message.room
    : null;
}

export interface CastSession {
  sendMessage(namespace: string, message: unknown): Promise<void>;
  endSession(stop: boolean): void;
  getCastDevice(): { friendlyName: string };
}
export interface SenderContext {
  setOptions(options: { receiverApplicationId: string; autoJoinPolicy: string }): void;
  getCurrentSession(): CastSession | null;
  requestSession(): Promise<void>;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}
export interface ReceiverContext {
  addCustomMessageListener(namespace: string, listener: (event: { data: unknown }) => void): void;
  start(options: {
    customNamespaces: Record<string, string>;
    disableIdleTimeout: boolean;
    skipPlayersLoad: boolean;
  }): void;
}
type CastWindow = Window & {
  __onGCastApiAvailable?: (available: boolean) => void;
  cast?: {
    framework: {
      CastContext?: { getInstance(): SenderContext };
      CastReceiverContext?: { getInstance(): ReceiverContext };
    };
  };
};
export const castWindow = () => window as CastWindow;
let sender: Promise<SenderContext> | undefined;
export function loadSender(): Promise<SenderContext> {
  return (sender ??= new Promise((resolve, reject) => {
    const w = castWindow();
    if (w.cast?.framework.CastContext) return resolve(w.cast.framework.CastContext.getInstance());
    const script = document.createElement("script");
    const timer = setTimeout(
      () =>
        reject(
          new Error("Cast could not load. Use Chrome on a computer and check your connection."),
        ),
      15000,
    );
    w.__onGCastApiAvailable = (available) => {
      clearTimeout(timer);
      if (available && w.cast?.framework.CastContext)
        resolve(w.cast.framework.CastContext.getInstance());
      else reject(new Error("Casting is unavailable in this browser. Use Chrome on a computer."));
    };
    script.src = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Google Cast could not load. Reload to retry."));
    };
    document.head.appendChild(script);
  }));
}
let receiver: Promise<ReceiverContext> | undefined;
export function loadReceiver(): Promise<ReceiverContext> {
  return (receiver ??= new Promise((resolve, reject) => {
    const existing = castWindow().cast?.framework.CastReceiverContext;
    if (existing) return resolve(existing.getInstance());
    const script = document.createElement("script");
    const timer = setTimeout(
      () => reject(new Error("Unable to load Google Cast. Please reconnect from the host.")),
      15000,
    );
    script.src = "https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js";
    script.onload = () => {
      clearTimeout(timer);
      const context = castWindow().cast?.framework.CastReceiverContext;
      if (context) resolve(context.getInstance());
      else reject(new Error("Open this screen through Google Cast on your TV."));
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Unable to load Google Cast."));
    };
    document.head.appendChild(script);
  }));
}
