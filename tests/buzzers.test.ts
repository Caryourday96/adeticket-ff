import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createApplication } from "../apps/server/src/app";
import { starterBank } from "@naija/content";
const server = createApplication({ database: ":memory:", password: "test" });
let base = "",
  host = "",
  id = "",
  a = "",
  b = "";
const post = (path: string, body: unknown, cookie = host) =>
  fetch(base + "/api" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
const path = (suffix: string) => `/games/${id}/${suffix}`;
beforeAll(async () => {
  await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + (server.http.address() as { port: number }).port;
  host = (await post("/login", { password: "test" }, "")).headers.get("set-cookie")!.split(";")[0];
  id = (
    await (
      await post("/games", {
        teams: [
          { name: "Jollof", members: ["Ada", "Bola"], captain: 0 },
          { name: "Suya", members: ["Chidi", "Dayo"], captain: 0 },
        ],
        questionIds: starterBank.questions.map((q) => q.id),
      })
    ).json()
  ).id;
});
afterAll(() => server.close());
it("pairs phones without revealing answers and requires host approval", async () => {
  const one = await post(path("player"), { team: 0, member: 0 }, "");
  a = one.headers.get("set-cookie")!.split(";")[0];
  expect(one.headers.get("set-cookie")).toContain("HttpOnly");
  expect(JSON.stringify(await one.json())).not.toContain("Jollof rice");
  b = (await post(path("player"), { team: 1, member: 0 }, "")).headers
    .get("set-cookie")!
    .split(";")[0];
  expect((await post(path("buzzers"), { action: "arm" }, a)).status).toBe(401);
  await post(path("buzzers"), { action: "arm" });
  expect(
    (await post(path("player/buzz"), { epoch: server.buzzers.public(id).epoch }, a)).status,
  ).toBe(400);
  for (const p of server.store.players(id))
    await post(path("buzzers"), { action: "approve", playerId: p.id });
});
it("accepts exactly one competing buzz and rejects repeats and stale epochs", async () => {
  await post(path("buzzers"), { action: "arm" });
  const epoch = server.buzzers.public(id).epoch;
  const results = await Promise.all([
    post(path("player/buzz"), { epoch }, a),
    post(path("player/buzz"), { epoch }, b),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  expect(server.store.host(id).revision).toBe(1);
  expect(server.buzzers.public(id).armed).toBe(false);
  expect(server.buzzers.public(id).winner).not.toBeNull();
  await post(path("commands"), { id: randomUUID(), revision: 1, command: { type: "undo" } });
  await post(path("buzzers"), { action: "arm" });
  expect((await post(path("player/buzz"), { epoch }, a)).status).toBe(400);
});
it("rejects teammates out of turn, paused games, and revoked phones", async () => {
  const response = await post(path("player"), { team: 0, member: 1 }, "");
  const other = response.headers.get("set-cookie")!.split(";")[0];
  const p = (await response.json()).player;
  await post(path("buzzers"), { action: "approve", playerId: p.id });
  await post(path("buzzers"), { action: "arm" });
  expect(
    (await post(path("player/buzz"), { epoch: server.buzzers.public(id).epoch }, other)).status,
  ).toBe(400);
  const epoch = server.buzzers.public(id).epoch;
  await post(path("commands"), { id: randomUUID(), revision: 2, command: { type: "pause" } });
  expect((await post(path("player/buzz"), { epoch }, a)).status).toBe(400);
  expect(server.buzzers.public(id).armed).toBe(false);
  const registered = server.store.players(id).find((p) => p.name === "Ada")!;
  await post(path("buzzers"), { action: "remove", playerId: registered.id });
  const view = await (
    await fetch(base + "/api" + path("player"), { headers: { Cookie: a } })
  ).json();
  expect(view.player).toBeNull();
});
