import { expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { io as client } from "socket.io-client";
import { starterBank, fastQuestions } from "@naija/content";
import { setupSchema } from "@naija/contracts";
import { createGame, transition } from "@naija/game";
import { Store } from "../apps/server/src/store";
import { createApplication } from "../apps/server/src/app";

const fresh = (id: string) =>
  createGame(
    id,
    setupSchema.parse({
      teams: [
        { name: "Jollof", members: ["Ada", "Tobi"], captain: 0 },
        { name: "Suya", members: ["Zee", "Obi"], captain: 0 },
      ],
      questionIds: starterBank.questions.map((q) => q.id),
    }),
    starterBank.questions,
    fastQuestions,
    starterBank.notice,
  );

it("indexes timer deadlines on existing databases and updates the index on pause and resume", () => {
  const folder = mkdtempSync(join(tmpdir(), "naija-efficiency-"));
  const path = join(folder, "game.sqlite");
  const legacy = new DatabaseSync(path);
  legacy.exec("CREATE TABLE games(id TEXT PRIMARY KEY, body TEXT NOT NULL)");
  legacy.close();
  const store = new Store(path);
  const inspector = new DatabaseSync(path);
  try {
    store.add(fresh("OLDER"));
    let state = fresh("TIMER");
    state.phase = "champion";
    state.winner = 0;
    state = transition(transition(state, { type: "fastStart", players: [0, 1] }), {
      type: "fastClock",
    });
    store.add(state);
    const deadline = state.fast!.deadline!;
    expect(store.expiredFastGames(deadline - 1)).toEqual([]);
    expect(store.expiredFastGames(deadline)).toEqual(["TIMER"]);
    store.apply("TIMER", { id: randomUUID(), revision: 0, command: { type: "pause" } });
    expect(store.expiredFastGames(Number.MAX_SAFE_INTEGER)).toEqual([]);
    store.apply("TIMER", { id: randomUUID(), revision: 1, command: { type: "pause" } });
    expect(store.expiredFastGames(Number.MAX_SAFE_INTEGER)).toEqual(["TIMER"]);
    const plan = inspector
      .prepare(
        `EXPLAIN QUERY PLAN SELECT id FROM games
      WHERE json_extract(body,'$.state.phase')='fast'
      AND json_extract(body,'$.state.fast.stage')='running'
      AND json_extract(body,'$.state.paused')=0
      AND json_extract(body,'$.state.fast.deadline')<=?`,
      )
      .all(deadline);
    expect(plan.map((row) => row.detail).join(" ")).toContain("USING INDEX games_running_deadline");
    expect(store.has("OLDER")).toBe(true);
    expect(store.has("MISSING")).toBe(false);
    expect(store.list()).toEqual([
      {
        id: "TIMER",
        teams: ["Jollof", "Suya"],
        phase: "fast",
        round: 1,
        revision: 2,
        rehearsal: false,
      },
      {
        id: "OLDER",
        teams: ["Jollof", "Suya"],
        phase: "faceoff",
        round: 1,
        revision: 0,
        rehearsal: false,
      },
    ]);
    const pack = store.addPack(starterBank);
    expect(store.pack(pack)).toEqual(starterBank);
    expect(store.pack("missing")).toBeUndefined();
  } finally {
    inspector.close();
    store.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

it("caches fingerprinted assets while revalidating HTML and never caching API responses", async () => {
  const folder = mkdtempSync(join(tmpdir(), "naija-static-"));
  mkdirSync(join(folder, "assets"));
  writeFileSync(join(folder, "index.html"), "<!doctype html><title>Test</title>");
  writeFileSync(join(folder, "assets", "index-AbCd1234.js"), "/* versioned */");
  writeFileSync(join(folder, "plain.js"), "/* unversioned */");
  const server = createApplication({ database: ":memory:", webDir: folder });
  try {
    await new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + (server.http.address() as { port: number }).port;
    for (const path of ["/", "/host/ABCDEF", "/plain.js"]) {
      const response = await fetch(base + path);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
      await response.text();
    }
    const asset = await fetch(base + "/assets/index-AbCd1234.js");
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    await asset.text();
    const health = await fetch(base + "/api/health");
    expect(health.headers.get("cache-control")).toBe("no-store");
    await health.text();
  } finally {
    await server.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

it("isolates host rooms, sanitizes audience updates and disconnects revoked hosts", async () => {
  const server = createApplication({ database: ":memory:" });
  await new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + (server.http.address() as { port: number }).port;
  const token = server.store.session();
  const host = client(base, {
    transports: ["websocket"],
    extraHeaders: { Cookie: "nf_host=" + token },
  });
  const viewer = client(base, { transports: ["websocket"] });
  const states: any[] = [];
  host.on("state", (state) => states.push(state));
  const room = (socket: typeof host, id: string, role: string) =>
    new Promise<void>((resolve, reject) =>
      socket
        .timeout(3000)
        .emit("join", { id, role }, (error: Error | null, result: any) =>
          error ? reject(error) : result.error ? reject(new Error(result.error)) : resolve(),
        ),
    );
  const command = async (id: string, revision: number) => {
    const response = await fetch(base + `/api/games/${id}/commands`, {
      method: "POST",
      headers: { Cookie: "nf_host=" + token, "Content-Type": "application/json" },
      body: JSON.stringify({ id: randomUUID(), revision, command: { type: "buzz", team: 0 } }),
    });
    expect(response.status).toBe(200);
    await response.json();
  };
  try {
    server.store.add(fresh("FIRST"));
    server.store.add(fresh("SECOND"));
    await room(host, "FIRST", "host");
    await room(host, "SECOND", "host");
    await room(viewer, "FIRST", "audience");
    const publicUpdate = new Promise<any>((resolve) => viewer.once("state", resolve));
    await command("FIRST", 0);
    const publicState = await publicUpdate;
    expect(publicState.questions).toBeUndefined();
    expect(publicState.history).toBeUndefined();
    expect(publicState.canUndo).toBeUndefined();
    const hostUpdate = new Promise<any>((resolve) => host.once("state", resolve));
    await command("SECOND", 0);
    expect((await hostUpdate).revision).toBe(1);
    expect(states.map((state) => [state.id, state.revision])).toEqual([
      ["FIRST", 0],
      ["SECOND", 0],
      ["SECOND", 1],
    ]);
    server.store.revoke(token);
    const disconnected = new Promise<void>((resolve) => host.once("disconnect", () => resolve()));
    // Phone registration also broadcasts, without needing a host session.
    const response = await fetch(base + "/api/games/SECOND/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: 0, member: 0 }),
    });
    expect(response.status).toBe(200);
    await response.json();
    await disconnected;
    expect(states).toHaveLength(3);
  } finally {
    host.disconnect();
    viewer.disconnect();
    await server.close();
  }
});
