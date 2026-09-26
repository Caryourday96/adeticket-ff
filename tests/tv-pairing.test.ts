import { expect, it } from "vitest";
import { createApplication } from "../apps/server/src/app";
import { createRehearsal } from "../apps/server/src/rehearsal";

it("pairs a TV once and sends only an existing public room with its controller token", async () => {
  const server = createApplication({ database: ":memory:" });
  try {
    server.store.add(createRehearsal("ABC123", "round"));
    await new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + (server.http.address() as { port: number }).port;
    const post = async (path: string, body: object) => {
      const response = await fetch(base + "/api/tv/" + path, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() as any };
    };
    const deviceId = "11111111-1111-4111-8111-111111111111";
    const deviceSecret = "a".repeat(64);
    const credentials = { deviceId, deviceSecret };
    const registered = await post("register", { ...credentials, name: "Living Room" });
    expect(registered.status).toBe(200);
    expect(registered.body.pairingCode).toMatch(/^[A-F0-9]{8}$/);
    expect((await post("poll", credentials)).body.room).toBeNull();
    const paired = await post("pair", { pairingCode: registered.body.pairingCode });
    expect(paired.body.deviceId).toBe(deviceId);
    expect(paired.body.controllerToken).toMatch(/^[a-f0-9]{64}$/);
    expect((await post("pair", { pairingCode: registered.body.pairingCode })).status).toBe(400);
    const reconnected = await post("register", { ...credentials, name: "Living Room" });
    expect(reconnected.body).toEqual({ pairingCode: null, paired: true });
    expect((await post("show", { deviceId, controllerToken: "b".repeat(64), room: "ABC123" })).status).toBe(400);
    expect((await post("show", { deviceId, controllerToken: paired.body.controllerToken, room: "FFFFFF" })).status).toBe(404);
    expect((await post("show", { deviceId, controllerToken: paired.body.controllerToken, room: "ABC123" })).body.ok).toBe(true);
    expect((await post("poll", credentials)).body.room).toBe("ABC123");
  } finally {
    await server.close();
  }
});
