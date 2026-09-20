import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createApplication } from "../apps/server/src/app";
import { starterBank } from "@naija/content";

it("registers player names, keeps host team names and enforces stage selection on the server", async () => {
  const server = createApplication({ database: ":memory:", password: "test" });
  await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.http.address() as { port: number }).port}/api`;
  const post = (path: string, body: unknown, cookie = "") =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });
  try {
    const host = (await post("/login", { password: "test" })).headers
      .get("set-cookie")!
      .split(";")[0];
    const { id } = await (
      await post(
        "/games",
        {
          teams: [
            {
              name: "Team Lagos",
              members: ["Waiting for players"],
              captain: 0,
              awaitingPlayers: true,
            },
            {
              name: "Team Abuja",
              members: ["Waiting for players"],
              captain: 0,
              awaitingPlayers: true,
            },
          ],
          questionIds: starterBank.questions.map((q) => q.id),
        },
        host,
      )
    ).json();
    const path = `/games/${id}`;
    const join = await post(path + "/player", { team: 0, name: "Ada" });
    expect(join.status).toBe(200);
    const phone = join.headers.get("set-cookie")!.split(";")[0];
    const { player } = await join.json();
    expect(player.approved).toBe(false);
    expect(server.store.host(id).teams[0].members).toEqual(["Waiting for players"]);
    expect((await post(path + "/player", { team: 0, name: "ada" })).status).toBe(400);
    expect(
      (await post(path + "/buzzers", { action: "stage", playerId: player.id }, phone)).status,
    ).toBe(401);
    expect(
      (await post(path + "/buzzers", { action: "approve", playerId: player.id }, host)).status,
    ).toBe(200);
    expect(server.store.host(id).teams[0].members).toEqual(["Ada"]);
    expect(server.store.host(id).teams[0].name).toBe("Team Lagos");
    await post(path + "/buzzers", { action: "arm" }, host);
    expect(
      (await post(path + "/player/buzz", { epoch: server.buzzers.public(id).epoch }, phone)).status,
    ).toBe(400);
    expect(
      (await post(path + "/buzzers", { action: "stage", playerId: player.id }, host)).status,
    ).toBe(200);
    expect(server.buzzers.public(id).armed).toBe(false);
    const teams = structuredClone(server.store.host(id).teams);
    teams[0].name = "Team Ibadan";
    await post(
      path + "/commands",
      {
        id: randomUUID(),
        revision: server.store.host(id).revision,
        command: { type: "roster", teams },
      },
      host,
    );
    const publicView = await fetch(base + path + "/audience").then((r) => r.json());
    expect(publicView.teams[0].name).toBe("Team Ibadan");
    const restored = await fetch(base + path + "/player", { headers: { Cookie: phone } }).then(
      (r) => r.json(),
    );
    expect(restored.player.name).toBe("Ada");
    expect(restored.player.approved).toBe(true);
    await post(path + "/buzzers", { action: "bench", playerId: player.id }, host);
    await post(path + "/buzzers", { action: "arm" }, host);
    expect(
      (await post(path + "/player/buzz", { epoch: server.buzzers.public(id).epoch }, phone)).status,
    ).toBe(400);
    await post(path + "/buzzers", { action: "stage", playerId: player.id }, host);
    await post(path + "/buzzers", { action: "arm" }, host);
    expect(
      (await post(path + "/player/buzz", { epoch: server.buzzers.public(id).epoch }, phone)).status,
    ).toBe(200);
  } finally {
    await server.close();
  }
});
