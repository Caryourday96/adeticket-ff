export async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch("/api" + path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Request failed.");
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
