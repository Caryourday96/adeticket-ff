import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { io as client } from "socket.io-client";
import { createApplication } from "../apps/server/src/app";
import { starterBank } from "@naija/content";
describe("HTTP and live authorization", () => {
  const server = createApplication({
    database: ":memory:",
    password: "test-only-passphrase",
    origin: "http://localhost:3000",
  });
  let base = "",
    cookie = "",
    id = "";
  beforeAll(async () => {
    await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
    base = "http://127.0.0.1:" + (server.http.address() as { port: number }).port;
  });
  afterAll(() => server.close());
  const post = (path: string, body: unknown, authenticated = true) =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(authenticated ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });
  it("requires host authentication and sets an HttpOnly session", async () => {
    expect((await fetch(base + "/api/packs")).status).toBe(401);
    expect((await post("/api/login", { password: "wrong" }, false)).status).toBe(401);
    const login = await post("/api/login", { password: "test-only-passphrase" }, false);
    expect(login.status).toBe(200);
    const header = login.headers.get("set-cookie")!;
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Strict");
    cookie = header.split(";")[0];
  });
  it("creates a game without granting audience host access", async () => {
    const response = await post("/api/games", {
      teams: [
        { name: "One", members: ["A", "B"], captain: 0 },
        { name: "Two", members: ["C", "D"], captain: 1 },
      ],
      questionIds: starterBank.questions.map((q) => q.id),
    });
    expect(response.status).toBe(201);
    id = (await response.json()).id;
    expect((await fetch(base + "/api/games/" + id + "/host")).status).toBe(401);
    const publicState = await (await fetch(base + "/api/games/" + id + "/audience")).json();
    expect(publicState.question.answers.every((a: { text: null }) => a.text === null)).toBe(true);
    expect(
      (
        await post(
          "/api/games/" + id + "/commands",
          { id: randomUUID(), revision: 0, command: { type: "buzz", team: 0 } },
          false,
        )
      ).status,
    ).toBe(401);
  });
  it("rejects a cross-origin write", async () => {
    const res = await fetch(base + "/api/games/" + id + "/commands", {
      method: "POST",
      headers: {
        Origin: "https://untrusted.example",
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(res.status).toBe(403);
  });
  it("broadcasts sanitized live updates and reconnects to the latest revision", async () => {
    const socket = client(base, { transports: ["websocket"], forceNew: true });
    const waitState = () =>
      new Promise<any>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Live update timed out")), 5000);
        socket.once("state", (s) => {
          clearTimeout(t);
          resolve(s);
        });
      });
    const initial = waitState();
    socket.emit("join", { id, role: "audience" });
    expect((await initial).revision).toBe(0);
    let update = waitState();
    await post("/api/games/" + id + "/commands", {
      id: randomUUID(),
      revision: 0,
      command: { type: "buzz", team: 0 },
    });
    expect((await update).revision).toBe(1);
    update = waitState();
    await post("/api/games/" + id + "/commands", {
      id: randomUUID(),
      revision: 1,
      command: { type: "answer", answerId: "a1" },
    });
    const shown = await update;
    expect(shown.question.answers[0].text).toBe("Jollof rice");
    expect(shown.question.answers[1].text).toBeNull();
    expect(shown.questions).toBeUndefined();
    socket.disconnect();
    socket.connect();
    const resumed = waitState();
    socket.emit("join", { id, role: "audience" });
    expect((await resumed).revision).toBe(2);
    socket.disconnect();
  });
  it("does not allow an unauthenticated socket to join the host stream", async () => {
    const socket = client(base, { transports: ["websocket"], forceNew: true });
    const result = await new Promise<any>((resolve) =>
      socket.emit("join", { id, role: "host" }, resolve),
    );
    expect(result.error).toContain("Host access");
    socket.disconnect();
  });
});
describe("restart recovery", () => {
  it("recovers persisted state and sessions from disk", async () => {
    const folder = mkdtempSync(join(tmpdir(), "naija-test-"));
    const path = join(folder, "game.sqlite");
    const first = createApplication({ database: path });
    const token = first.store.session();
    const { createGame } = await import("@naija/game");
    const { setupSchema } = await import("@naija/contracts");
    const { fastQuestions } = await import("@naija/content");
    first.store.add(
      createGame(
        "DISK01",
        setupSchema.parse({
          teams: [
            { name: "One", members: ["A"], captain: 0 },
            { name: "Two", members: ["B"], captain: 0 },
          ],
          questionIds: starterBank.questions.map((q) => q.id),
        }),
        starterBank.questions,
        fastQuestions,
        "Sample",
      ),
    );
    first.store.apply("DISK01", {
      id: randomUUID(),
      revision: 0,
      command: { type: "buzz", team: 1 },
    });
    const phone = first.buzzers.join("DISK01", 0, 0);
    const registration = first.store.player("DISK01", phone)!;
    first.buzzers.control("DISK01", "approve", registration.id);
    await first.close();
    const second = createApplication({ database: path });
    expect(second.store.host("DISK01").face.first).toBe(1);
    expect(second.store.authorized(token)).toBe(true);
    expect(second.store.player("DISK01", phone)?.approved).toBe(true);
    expect(second.buzzers.public("DISK01").armed).toBe(false);
    await second.close();
    rmSync(folder, { recursive: true, force: true });
  });
});
