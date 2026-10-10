import { afterEach, expect, it, vi } from "vitest";
import { api } from "../apps/web/src/lib/api";

afterEach(() => vi.unstubAllGlobals());

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
