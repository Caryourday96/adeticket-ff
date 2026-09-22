import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { castRoom } from "../apps/web/src/lib/cast";
import { createApplication } from "../apps/server/src/app";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it("accepts room selection and rejects URLs, commands and malformed room codes", () => {
  expect(castRoom({ type: "SHOW_ROOM", room: "ABC123" })).toBe("ABC123");
  expect(castRoom(JSON.stringify({ type: "SHOW_ROOM", room: "ABC123" }))).toBe("ABC123");
  for (const value of [
    null,
    "ABC123",
    "not valid json",
    {},
    { type: "command", room: "ABC123" },
    { type: "SHOW_ROOM", room: "https://example.com/host/ABC123" },
    { type: "SHOW_ROOM", room: "../../host" },
    { type: "SHOW_ROOM", room: "ABC123\n" },
    { type: "SHOW_ROOM", room: 123456 },
  ])
    expect(castRoom(value)).toBeNull();
});

it.each([undefined, "A1B2C3D4"])(
  "exposes only the public Cast ID (%s), without granting host access",
  async (castAppId) => {
    const web = mkdtempSync(resolve(".data-cast-test-"));
    writeFileSync(
      resolve(web, "index.html"),
      '<html><head></head><body><script src="/app.js"></script></body></html>',
    );
    const server = createApplication({
      database: ":memory:",
      password: "private-test-password",
      castAppId,
      webDir: web,
    });
    try {
      await new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", resolve));
      const base = "http://127.0.0.1:" + (server.http.address() as { port: number }).port;
      const config = await fetch(base + "/api/config");
      expect(config.status).toBe(200);
      expect(await config.json()).toEqual({ castAppId: castAppId ?? null });
      expect(config.headers.get("cache-control")).toBe("no-store");
      const receiver = await fetch(base + "/cast");
      await receiver.text();
      expect(config.headers.get("content-security-policy")).not.toContain("www.gstatic.com");
      expect(receiver.headers.get("content-security-policy")).toContain(
        "script-src 'self' https://www.gstatic.com https://www.google.com",
      );
      const games = await fetch(base + "/api/games");
      expect(games.status).toBe(401);
      await games.text();
    } finally {
      await server.close();
      rmSync(web, { recursive: true, force: true });
    }
  },
);

it("loads the sender once and resolves only after Google reports availability", async () => {
  const fakeWindow: any = {};
  const scripts: any[] = [];
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("document", {
    createElement: () => ({}),
    head: { appendChild: (script: unknown) => scripts.push(script) },
  });
  const { loadSender } = await import("../apps/web/src/lib/cast");
  const first = loadSender();
  expect(loadSender()).toBe(first);
  expect(scripts).toHaveLength(1);
  expect(scripts[0].src).toContain("loadCastFramework=1");
  const context = {};
  fakeWindow.cast = { framework: { CastContext: { getInstance: () => context } } };
  fakeWindow.__onGCastApiAvailable(true);
  expect(await first).toBe(context);
});

it("reports unsupported browsers instead of claiming casting is available", async () => {
  const fakeWindow: any = {};
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("document", { createElement: () => ({}), head: { appendChild: () => {} } });
  const { loadSender } = await import("../apps/web/src/lib/cast");
  const result = loadSender();
  fakeWindow.__onGCastApiAvailable(false);
  await expect(result).rejects.toThrow("unavailable in this browser");
});

it("loads the separate receiver SDK and returns its context", async () => {
  const fakeWindow: any = {};
  let script: any;
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("document", {
    createElement: () => ({}),
    head: {
      appendChild: (value: unknown) => {
        script = value;
      },
    },
  });
  const { loadReceiver } = await import("../apps/web/src/lib/cast");
  const result = loadReceiver();
  expect(script.src).toContain("caf_receiver");
  const context = {};
  fakeWindow.cast = { framework: { CastReceiverContext: { getInstance: () => context } } };
  script.onload();
  expect(await result).toBe(context);
});
