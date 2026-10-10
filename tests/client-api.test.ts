import { afterEach, expect, it, vi } from "vitest";
import { api } from "../apps/web/src/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each(["headers", "body"])("bounds a stalled response at %s without retrying", async (stage) => {
  vi.useFakeTimers();
  const fetch = vi.fn((_url: string, options: RequestInit) => {
    const stalled = () =>
      new Promise((_resolve, reject) => {
        options.signal!.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    return stage === "headers" ? stalled() : Promise.resolve({ ok: true, json: stalled });
  });
  vi.stubGlobal("fetch", fetch);
  const result = expect(api("/games/ABC123/commands", {})).rejects.toThrow(
    "It may already have been applied. Refresh and check the latest state",
  );
  await vi.advanceTimersByTimeAsync(15000);
  await result;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("cleans up the deadline after a successful response", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ revision: 1 })));
  await api("/games/ABC123/host");
  expect(vi.getTimerCount()).toBe(0);
});

it("handles HTML outage responses without retrying a command", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response("<html>Gateway error</html>", { status: 502 }));
  vi.stubGlobal("fetch", fetch);
  await expect(api("/games/ABC123/commands", { command: { type: "pause" } })).rejects.toThrow(
    "Request failed (HTTP 502). Refresh and check the latest state before trying again.",
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("preserves server conflict wording used by host recovery", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(Response.json({ error: "The game changed. Refresh." }, { status: 409 })),
  );
  await expect(api("/games/ABC123/commands", {})).rejects.toThrow("The game changed. Refresh.");
});

it("handles an empty or invalid successful response without claiming a failed action", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
  await expect(api("/games/ABC123/commands", {})).rejects.toThrow("unreadable response");
});

it.each([null, { error: {} }, { error: "" }])(
  "handles invalid error payload %j",
  async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload, { status: 503 })));
    await expect(api("/config")).rejects.toThrow("Request failed (HTTP 503)");
  },
);

it("returns valid successful JSON unchanged", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ revision: 12 })));
  await expect(api("/games/ABC123/host")).resolves.toEqual({ revision: 12 });
});
