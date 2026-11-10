import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { io as client, type Socket } from "socket.io-client";
import { createApplication } from "../apps/server/src/app";
import { starterBank } from "@naija/content";

describe("multi-group HTTP and live boundaries", () => {
  const server = createApplication({ database: ":memory:", password: "old-fixture-passphrase" });
  let base = "",
    owner = "",
    adminA = "",
    adminB = "",
    host = "",
    groupA = "",
    groupB = "",
    gameA = "",
    gameB = "",
    hostId = "";
  const sockets: Socket[] = [];
  const request = (path: string, cookie = "", body?: unknown, group?: string) =>
    fetch(base + "/api" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...(group ? { "X-Group-Id": group } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const json = async (path: string, cookie = "", body?: unknown, group?: string) => {
    const response = await request(path, cookie, body, group);
    const result = await response.json();
    expect(response.ok, JSON.stringify(result)).toBe(true);
    return result;
  };
  const accept = async (group: string, email: string, role: "admin" | "host") => {
    const invite = await json(`/platform/groups/${group}/invitations`, owner, { email, role });
    const response = await request("/platform/invitations/accept", "", {
      token: invite.token,
      email,
      password: "synthetic-long-password",
    });
    expect(response.status).toBe(200);
    return response.headers.get("set-cookie")!.split(";")[0];
  };
  const setup = {
    teams: [
      { name: "Lagos", members: ["Ada"], captain: 0 },
      { name: "Abuja", members: ["Tobi"], captain: 0 },
    ],
    questionIds: starterBank.questions.map((q) => q.id),
  };
  const joinSocket = async (id: string, role: string, cookie = "") => {
    const socket = client(base, {
      transports: ["websocket"],
      forceNew: true,
      extraHeaders: { Cookie: cookie },
    });
    sockets.push(socket);
    const result = await new Promise<any>((resolve) => socket.emit("join", { id, role }, resolve));
    return { socket, result };
  };
  const command = async (game: string, cookie: string, value: unknown) =>
    json(`/games/${game}/commands`, cookie, {
      id: randomUUID(),
      revision: server.store.host(game).revision,
      command: value,
    });
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
    const old = server.store.session();
    await server.store.platform.bootstrap("owner@example.test", "synthetic-owner-password");
    expect(server.store.authorized(old)).toBe(false);
    const response = await request("/login", "", {
      email: "owner@example.test",
      password: "synthetic-owner-password",
    });
    expect(response.status).toBe(200);
    owner = response.headers.get("set-cookie")!.split(";")[0];
    groupA = (await json("/platform/groups", owner, { name: "Group A" })).id;
    groupB = (await json("/platform/groups", owner, { name: "Group B" })).id;
    adminA = await accept(groupA, "admin-a@example.test", "admin");
    adminB = await accept(groupB, "admin-b@example.test", "admin");
    host = await accept(groupA, "host-a@example.test", "host");
    hostId = (await json("/session", host)).user.id;
    gameA = (await json("/games", adminA, setup, groupA)).id;
    gameB = (await json("/games", adminB, setup, groupB)).id;
  });
  afterAll(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await server.close();
  });

  it("requires explicit accounts, isolates dashboards and rejects cross-group resource access", async () => {
    expect((await request("/login", "", { password: "old-fixture-passphrase" })).status).toBe(401);
    expect((await request("/platform/users", adminA)).status).toBe(403);
    expect((await request("/platform/groups", adminA, { name: "Intruder" })).status).toBe(403);
    expect((await json("/games", adminA, undefined, groupA)).map((g: any) => g.id)).toEqual([
      gameA,
    ]);
    expect(await json("/games", adminA, undefined, groupB)).toEqual([]);
    for (const suffix of ["host", "buzzers", "diagnostics", "answers"])
      expect((await request(`/games/${gameB}/${suffix}`, adminA)).status).toBe(403);
    for (const [suffix, body] of [
      ["commands", { id: randomUUID(), revision: 0, command: { type: "endGame" } }],
      ["delete", { revision: 0 }],
      ["buzzers", { action: "arm" }],
    ] as const)
      expect((await request(`/games/${gameB}/${suffix}`, adminA, body)).status).toBe(403);
    expect((await request("/games", adminA, setup, groupB)).status).toBe(403);
    expect((await request("/games", adminA, { ...setup, reuseFrom: gameB }, groupA)).status).toBe(
      403,
    );
    expect((await joinSocket(gameB, "host", adminA)).result.error).toBeTruthy();
    expect((await joinSocket(gameA, "host")).result.error).toBeTruthy();
  });
  it("keeps custom banks, surveys and question usage inside the selected group", async () => {
    const pack = await json(
      "/packs",
      adminA,
      { ...starterBank, title: "Private group A bank" },
      groupA,
    );
    expect(
      (await json("/packs", adminB, undefined, groupB)).some((p: any) => p.id === pack.id),
    ).toBe(false);
    expect((await request("/games", adminB, { ...setup, packId: pack.id }, groupB)).status).toBe(
      400,
    );
    expect(
      (
        await request(
          "/rehearsals",
          adminB,
          { scenario: "fast", packId: pack.id, questionIds: setup.questionIds.slice(0, 5) },
          groupB,
        )
      ).status,
    ).toBe(400);
    const survey = await json(
      "/surveys",
      adminA,
      {
        title: "Private group survey",
        roundType: "regular",
        questions: starterBank.questions
          .slice(0, 5)
          .map((q) => ({ prompt: q.prompt, category: q.category })),
      },
      groupA,
    );
    expect(await json("/surveys", adminB, undefined, groupB)).toEqual([]);
    for (const suffix of ["manage", "export"])
      expect((await request(`/surveys/${survey.id}/${suffix}`, adminB)).status).toBe(403);
    expect(
      (await request(`/surveys/${survey.id}/status`, adminB, { open: false, revision: 0 })).status,
    ).toBe(403);
    expect(
      (await json("/question-usage", adminB, undefined, groupB)).every(
        (u: any) => u.game === gameB,
      ),
    ).toBe(true);
    expect((await request("/packs", host, undefined, groupA)).status).toBe(403);
  });
  it("grants assigned hosts only their game and immediately revokes live access", async () => {
    expect((await request(`/games/${gameA}/host`, host)).status).toBe(403);
    await json(`/platform/games/${gameA}/hosts`, adminA, { userId: hostId });
    expect((await request(`/games/${gameA}/host`, host)).status).toBe(200);
    expect((await request(`/games/${gameA}/delete`, host, { revision: 0 })).status).toBe(403);
    const live = await joinSocket(gameA, "host", host);
    expect(live.result.ok).toBe(true);
    const revoked = new Promise<void>((resolve) =>
      live.socket.once("accessRevoked", () => resolve()),
    );
    await json(`/platform/games/${gameA}/hosts`, adminA, { userId: hostId, remove: true });
    await revoked;
    expect((await request(`/games/${gameA}/host`, host)).status).toBe(403);
    expect((await request(`/games/${gameB}/host`, host)).status).toBe(403);
  });
  it("runs independent lobbies, resolves one simultaneous buzz and sends no hidden answers", async () => {
    const first = server.store.host(gameA);
    expect(first.lobby).toBe(true);
    expect((await request(`/games/${gameA}/buzzers`, adminA, { action: "arm" })).status).toBe(400);
    const publicBefore = await json(`/games/${gameA}/audience`);
    expect(publicBefore.questions).toBeUndefined();
    expect(publicBefore.question.answers.every((a: any) => a.text === null)).toBe(true);
    const phones: { cookie: string; id: string }[] = [];
    for (const team of [0, 1]) {
      const response = await request(`/games/${gameA}/player`, "", { team, member: 0 });
      expect(response.status).toBe(200);
      const player = (await response.json()).player;
      phones.push({ cookie: response.headers.get("set-cookie")!.split(";")[0], id: player.id });
      await json(`/games/${gameA}/buzzers`, adminA, { action: "approve", playerId: player.id });
      await json(`/games/${gameA}/buzzers`, adminA, { action: "stage", playerId: player.id });
    }
    await command(gameA, adminA, { type: "startGame" });
    await json(`/games/${gameA}/buzzers`, adminA, { action: "arm" });
    const epoch = server.buzzers.public(gameA).epoch;
    const results = await Promise.all(
      phones.map((p) => request(`/games/${gameA}/player/buzz`, p.cookie, { epoch })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(server.store.host(gameB).revision).toBe(0);
    expect(server.store.host(gameB).lobby).toBe(true);
    const winner = phones[results.findIndex((r) => r.ok)];
    const guess = {
      id: randomUUID(),
      revision: server.store.host(gameA).revision,
      text: "My private guess",
    };
    await json(`/games/${gameA}/player/answer`, winner.cookie, guess);
    await json(`/games/${gameA}/player/answer`, winner.cookie, guess);
    expect((await json(`/games/${gameA}/answers`, adminA)).answers).toHaveLength(1);
    expect(JSON.stringify(await json(`/games/${gameA}/audience`))).not.toContain(guess.text);
    const publicSocket = await joinSocket(gameA, "audience");
    const update = new Promise<any>((resolve) => publicSocket.socket.once("state", resolve));
    await command(gameA, adminA, { type: "answer", answerId: first.questions[0].answers[0].id });
    const shown = await update;
    expect(shown.question.answers[0].text).toBe(first.questions[0].answers[0].text);
    expect(shown.question.answers[1].text).toBeNull();
    expect(shown.questions).toBeUndefined();
    expect((await request(`/games/${gameA}/host`, winner.cookie)).status).toBe(401);
  });
  it("suspends public rooms and existing streams without affecting other groups", async () => {
    const live = await joinSocket(gameA, "audience");
    const revoked = new Promise<void>((resolve) =>
      live.socket.once("accessRevoked", () => resolve()),
    );
    await json(`/platform/groups/${groupA}`, owner, { suspended: true });
    await revoked;
    expect((await request(`/games/${gameA}/audience`)).status).toBe(404);
    expect((await request(`/games/${gameA}/host`, adminA)).status).toBe(404);
    expect((await joinSocket(gameA, "audience")).result.error).toBeTruthy();
    expect((await request(`/games/${gameB}/audience`)).status).toBe(200);
    expect((await request(`/games/${gameB}/host`, adminB)).status).toBe(200);
    await json(`/platform/groups/${groupA}`, owner, { suspended: false });
    expect((await request(`/games/${gameA}/host`, adminA)).status).toBe(200);
  });
});
