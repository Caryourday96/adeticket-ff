export async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch("/api" + path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
  });
  const fallback = r.ok
    ? "The server returned an unreadable response. Refresh and check the latest state before trying again."
    : `Request failed (HTTP ${r.status}). Refresh and check the latest state before trying again.`;
  let data: unknown;
  try {
    data = await r.json();
  } catch {
    throw new Error(fallback);
  }
  if (!r.ok) {
    const detail = data && typeof data === "object" && "error" in data ? data.error : undefined;
    throw new Error(typeof detail === "string" && detail.trim() ? detail : fallback);
  }
  return data as T;
}
export function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
