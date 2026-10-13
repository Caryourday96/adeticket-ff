import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApplication } from "../apps/server/src/app";
import { starterBank } from "@naija/content";

it("carries approved phones into a fresh game without losing history, surviving restart and enforcing authorization", async () => {
  const dir = mkdtempSync(join(tmpdir(), "showdown-next-"));
  const database = join(dir, "games.sqlite");
  let server = createApplication({ database, password: "test" });
  let base = "";
  const listen = async () => {
    await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.http.address() as { port: number }).port}/api`;
  };
  const post = (path: string, body: unknown, cookie = "") =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });
  const cookieOf = (r: Response) => r.headers.get("set-cookie")!.split(";")[0];
  const setup = {
    teams: [
      { name: "Lagos", members: ["Ada"], captain: 0 },
      { name: "Abuja", members: ["Bola"], captain: 0 },
    ],
    questionIds: starterBank.questions.map((q) => q.id),
  };
  try {
    await listen();
    const host = cookieOf(await post("/login", { password: "test" }));
    const { id: old } = await (await post("/games", setup, host)).json();
    const joined = await post(`/games/${old}/player`, { team: 0, name: "Ada" });
    const phone = cookieOf(joined),
      player = (await joined.json()).player;
    const pendingResponse = await post(`/games/${old}/player`, { team: 1, name: "Bola" });
    const pending = cookieOf(pendingResponse);
    await post(`/games/${old}/buzzers`, { action: "approve", playerId: player.id }, host);
    expect((await post("/games", { ...setup, reuseFrom: old }, host)).status).toBe(400);
    await post(
      `/games/${old}/commands`,
      { id: randomUUID(), revision: server.store.host(old).revision, command: { type: "endGame" } },
      host,
    );
    const original = server.store.saved(old);
    expect((await post("/games", { ...setup, reuseFrom: old })).status).toBe(401);
    const created = await post("/games", { ...setup, reuseFrom: old }, host);
    expect(created.status).toBe(201);
    const { id: next } = await created.json();
    expect(server.store.saved(old)).toEqual(original);
    expect(server.store.host(next).teams).toEqual(original.state.teams);
    expect(server.store.host(next).scores).toEqual([0, 0]);
    expect(server.store.players(next)).toHaveLength(1);
    expect(server.store.players(next)[0]).toMatchObject({
      name: "Ada",
      approved: true,
      onStage: false,
    });
    expect(server.store.players(next)[0].id).not.toBe(player.id);
    expect((await (await post("/games", { ...setup, reuseFrom: old }, host)).json()).id).toBe(next);
    expect((await post(`/games/${old}/player/continue`, {}, pending)).status).toBe(403);
    expect((await post(`/games/${old}/player/continue`, {})).status).toBe(403);
    await server.close();
    server = createApplication({ database, password: "test" });
    await listen();
    const view = await fetch(base + `/games/${old}/player`, { headers: { Cookie: phone } }).then(
      (r) => r.json(),
    );
    expect(view.nextGame).toBe(next);
    const continued = await post(`/games/${old}/player/continue`, {}, phone);
    expect(continued.status).toBe(200);
    expect(continued.headers.get("set-cookie")).toContain(`Path=/api/games/${next}`);
    expect(continued.headers.get("set-cookie")).toContain("HttpOnly");
    const newCookie = cookieOf(continued);
    const newView = await fetch(base + `/games/${next}/player`, {
      headers: { Cookie: newCookie },
    }).then((r) => r.json());
    expect(newView.player).toMatchObject({ name: "Ada", approved: true, onStage: false });
    expect(newView.buzzer.armed).toBe(false);
    server.store.removePlayer(next, newView.player.id);
    expect((await post(`/games/${old}/player/continue`, {}, phone)).status).toBe(403);
  } finally {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
