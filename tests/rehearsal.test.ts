import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createApplication } from "../apps/server/src/app";
import { createRehearsal } from "../apps/server/src/rehearsal";
import { transition } from "@naija/game";
import { passwordVerifier } from "../apps/server/src/password";

it("changes a ready Fast Money timer without allowing changes during a running turn", () => {
  const ready = createRehearsal("ABC123", "fast");
  const changed = transition(ready, { type: "fastDuration", seconds: 45 }, 1000);
  expect(changed.fast?.remaining).toBe(45000);
  const running = transition(changed, { type: "fastClock" }, 2000);
  expect(running.fast?.deadline).toBe(47000);
  expect(() => transition(running, { type: "fastDuration", seconds: 60 })).toThrow(
    "before starting",
  );
  expect(() => transition(ready, { type: "fastDuration", seconds: 0 })).toThrow("10–120");
  expect(ready.fast?.remaining).toBe(20000);
});

it("simulates through the real buzzer lock and winner checks, only in rehearsals", async () => {
  const server = createApplication({ database: ":memory:" });
  try {
    const state = createRehearsal("ABC123", "round");
    server.store.add(state);
    expect(state.rehearsal).toBe(true);
    const locked = server.buzzers.public(state.id);
    expect(() => server.buzzers.simulate(state.id, 0, locked.epoch)).toThrow("locked");
    server.buzzers.control(state.id, "arm");
    const epoch = server.buzzers.public(state.id).epoch;
    server.buzzers.simulate(state.id, 1, epoch);
    expect(server.store.host(state.id).face.first).toBe(1);
    expect(server.buzzers.public(state.id).winner?.name).toBe("Zainab");
    expect(() => server.buzzers.simulate(state.id, 0, epoch)).toThrow("locked");
    expect(server.store.players(state.id)).toEqual([]);
    const real = { ...state, id: "ABC124", rehearsal: false };
    server.store.add(real);
    expect(() => server.buzzers.simulate(real.id, 0, epoch)).toThrow("only available in rehearsal");
  } finally {
    await server.close();
  }
});

it("ends a paused timed game without awarding unfinished points, and supports undo", async () => {
  const server = createApplication({ database: ":memory:" });
  try {
    const fast = createRehearsal("ABC123", "fast");
    const running = transition(transition(fast, { type: "fastClock" }), { type: "pause" });
    server.store.add(running);
    const ended = server.store.apply(fast.id, {
      id: randomUUID(),
      revision: 0,
      command: { type: "endGame" },
    });
    expect(ended.phase).toBe("finished");
    expect(ended.scores).toEqual([300, 150]);
    expect(ended.fast?.deadline).toBeNull();
    expect(server.store.expiredFastGames(Number.MAX_SAFE_INTEGER)).toEqual([]);
    const restored = server.store.apply(fast.id, {
      id: randomUUID(),
      revision: 1,
      command: { type: "undo" },
    });
    expect(restored.phase).toBe("fast");
    expect(restored.paused).toBe(true);
  } finally {
    await server.close();
  }
});

it("requires host access and a current revision to delete only the selected game and phones", async () => {
  const server = createApplication({ database: ":memory:" });
  try {
    await new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + (server.http.address() as { port: number }).port;
    const cookie = "nf_host=" + server.store.session();
    const post = (path: string, body: unknown, authenticated = true) =>
      fetch(base + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authenticated ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(body),
      });
    expect((await post("/api/rehearsals", { scenario: "round" }, false)).status).toBe(401);
    const created = await post("/api/rehearsals", { scenario: "round" });
    expect(created.status).toBe(201);
    const { id } = await created.json();
    server.store.add(createRehearsal("ABCDEF", "fast"));
    server.buzzers.join(id, 0, 0);
    expect((await post(`/api/games/${id}/delete`, { revision: 0 }, false)).status).toBe(401);
    expect((await post(`/api/games/${id}/delete`, { revision: 5 })).status).toBe(400);
    expect(server.store.has(id)).toBe(true);
    expect((await post(`/api/games/${id}/delete`, { revision: 0 })).status).toBe(200);
    expect(server.store.has(id)).toBe(false);
    expect(server.store.players(id)).toEqual([]);
    expect(server.store.has("ABCDEF")).toBe(true);
  } finally {
    await server.close();
  }
});

it("verifies passwords with scrypt and rejects invalid input", async () => {
  const verify = passwordVerifier("a-test-passphrase");
  expect(await verify("a-test-passphrase")).toBe(true);
  expect(await verify("wrong")).toBe(false);
  expect(await verify({ password: "a-test-passphrase" })).toBe(false);
  expect(await verify("x".repeat(1025))).toBe(false);
});

it("rate limits login even when a caller spoofs forwarding headers", async () => {
  const server = createApplication({ database: ":memory:", password: "test-passphrase" });
  try {
    await new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + (server.http.address() as { port: number }).port;
    for (let i = 0; i < 11; i++) {
      const response = await fetch(base + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": `192.0.2.${i + 1}` },
        body: JSON.stringify({ password: "wrong" }),
      });
      expect(response.status).toBe(i < 10 ? 401 : 429);
      if (i === 10) expect(response.headers.get("retry-after")).toBeTruthy();
      await response.text();
    }
  } finally {
    await server.close();
  }
});
