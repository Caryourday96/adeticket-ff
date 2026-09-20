import { expect, it } from "vitest";
import { createApplication } from "../apps/server/src/app";

it("allows both configured domains while rejecting lookalikes for writes and sockets", async () => {
  const server = createApplication({
    database: ":memory:",
    password: "test",
    production: true,
    origin: "https://naijafeud.kayodeadetunji.com, https://ff.kayodeadetunji.com",
  });
  await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
  try {
    for (const origin of [
      "https://naijafeud.kayodeadetunji.com",
      "https://ff.kayodeadetunji.com",
      "https://ff.kayodeadetunji.com.evil.example",
    ]) {
      const allowed = !origin.endsWith("evil.example");
      const response = await fetch(base + "/api/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ password: "test" }),
      });
      expect(response.status).toBe(allowed ? 200 : 403);
      const socket = await fetch(base + "/socket.io/?EIO=4&transport=polling", {
        headers: { Origin: origin },
      });
      expect(socket.status).toBe(allowed ? 200 : 403);
    }
  } finally {
    await server.close();
  }
});
