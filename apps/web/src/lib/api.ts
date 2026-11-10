export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function selectedGroup(): string | null {
  try {
    const queryGroup = new URLSearchParams(location.search).get("group");
    if (queryGroup) return queryGroup;
    return sessionStorage.getItem("ff-group");
  } catch {
    return null;
  }
}
export function groupHref(path: string, group = selectedGroup()): string {
  if (!group) return path;
  const [pathname, search = ""] = path.split("?");
  const query = new URLSearchParams(search);
  query.set("group", group);
  return `${pathname}?${query}`;
}
export function clearPrivateCaches() {
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("ff-fast-draft:") || key === "ff-group") sessionStorage.removeItem(key);
  } catch {}
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("friends-showdown:host:") || key === "ff-setup-preset-v1")
        localStorage.removeItem(key);
  } catch {}
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutMessage =
    "The request timed out. It may already have been applied. Refresh and check the latest state before trying again.";
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const group = selectedGroup();
    const r = await fetch("/api" + path, {
      credentials: "same-origin",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(group ? { "X-Group-Id": group } : {}),
      },
      ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
    });
    if (r.status === 401 || r.status === 403 || (path === "/logout" && r.ok)) clearPrivateCaches();
    if (
      r.status === 401 &&
      path !== "/login" &&
      !path.startsWith("/platform/invitation") &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event("ff-session-expired"));
    const fallback = r.ok
      ? "The server returned an unreadable response. Refresh and check the latest state before trying again."
      : `Request failed (HTTP ${r.status}). Refresh and check the latest state before trying again.`;
    let data: unknown;
    try {
      data = await r.json();
    } catch {
      if (controller.signal.aborted) throw new Error(timeoutMessage);
      throw new Error(fallback);
    }
    if (!r.ok) {
      const detail = data && typeof data === "object" && "error" in data ? data.error : undefined;
      throw new ApiError(typeof detail === "string" && detail.trim() ? detail : fallback, r.status);
    }
    return data as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(timeoutMessage);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
