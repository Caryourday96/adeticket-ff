import { expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { advertisingConfig } from "../apps/server/src/advertising";
import { createApplication } from "../apps/server/src/app";

const configured = {
  ADS_ENABLED: "true",
  ADS_CONSENT_READY: "true",
  ADSENSE_CLIENT: "ca-pub-1234567890123456",
  ADSENSE_RULES_SLOT: "1234567890",
};

it("requires explicit activation, valid IDs and completed consent setup", () => {
  expect(advertisingConfig({}).enabled).toBe(false);
  for (const field of Object.keys(configured)) {
    expect(advertisingConfig({ ...configured, [field]: "" }).enabled).toBe(false);
  }
  expect(
    advertisingConfig({ ...configured, ADSENSE_CLIENT: "<script>alert(1)</script>" }).publisher,
  ).toBe("");
  expect(advertisingConfig(configured).enabled).toBe(true);
});

it("isolates advertising to rules, uses fresh nonces and never caches injected HTML", async () => {
  const web = mkdtempSync(resolve(".data-ads-test-"));
  writeFileSync(
    resolve(web, "index.html"),
    '<html><head></head><body><script src="/app.js"></script></body></html>',
  );
  const server = createApplication({
    database: ":memory:",
    webDir: web,
    advertising: advertisingConfig(configured),
  });
  await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
  try {
    const first = await fetch(base + "/rules");
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(await first.text()).toContain('name="advertising-client"');
    const policy = first.headers.get("content-security-policy");
    expect(policy).toContain("'strict-dynamic'");
    expect((await fetch(base + "/rules")).headers.get("content-security-policy")).not.toBe(policy);
    for (const path of [
      "/play",
      "/play/ABCDEF",
      "/host/ABCDEF",
      "/audience/ABCDEF",
      "/survey/test",
      "/privacy",
    ]) {
      const response = await fetch(base + path);
      expect(await response.text()).not.toContain("advertising-client");
      expect(response.headers.get("content-security-policy")).not.toContain("strict-dynamic");
    }
    expect(await (await fetch(base + "/ads.txt")).text()).toBe(
      "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n",
    );
  } finally {
    await server.close();
    rmSync(web, { recursive: true, force: true });
  }
});

it("returns 404 for ads.txt when advertising is not configured", async () => {
  const server = createApplication({
    database: ":memory:",
    advertising: advertisingConfig({}),
  });
  await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.http.address() as { port: number }).port}`;
  try {
    const res = await fetch(base + "/ads.txt");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("Advertising is not configured");
  } finally {
    await server.close();
  }
});
