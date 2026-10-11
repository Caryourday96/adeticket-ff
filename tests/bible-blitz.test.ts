import { expect, it } from "vitest";
import { io } from "socket.io-client";
import { createApplication } from "../apps/server/src/app";

it("mounts Bible Blitz separately without widening Friends Showdown permissions", async () => {
  const server = createApplication({
    database: ":memory:",
    password: "test",
    production: true,
    origin: "https://ff.adeticket.com",
  });
  await new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
  const player = io(base, {
    path: "/bibleblitz/socket.io",
    transports: ["websocket"],
    reconnection: false,
    extraHeaders: { Origin: "https://adeticket.com" },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      player.once("connect", resolve);
      player.once("connect_error", reject);
    });
    const reply = await player.timeout(2000).emitWithAck("join", { code: "ABC234", name: "Test" });
    expect(reply.ok).toBe(false);
    expect(reply.error).toMatch(/room/i);
    for (const [path, origin, status] of [
      ["/socket.io", "https://ff.adeticket.com", 200],
      ["/socket.io", "https://adeticket.com", 403],
      ["/bibleblitz/socket.io", "https://adeticket.com", 200],
      ["/bibleblitz/socket.io", "https://unrelated.example", 403],
    ] as const) {
      expect(
        (await fetch(`${base}${path}/?EIO=4&transport=polling`, { headers: { Origin: origin } }))
          .status,
      ).toBe(status);
    }
    expect((await fetch(`${base}/api/packs`)).status).toBe(401);
    expect((await fetch(`${base}/api/health`)).status).toBe(200);
  } finally {
    player.disconnect();
    await server.close();
  }
});
