import { expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApplication } from "../apps/server/src/app";

it("serves SPA deep links from a hidden checkout without exposing hidden files or unknown APIs", async () => {
  const folder = mkdtempSync(join(tmpdir(), "showdown-preview-"));
  const web = join(folder, ".preview", "web");
  mkdirSync(web, { recursive: true });
  writeFileSync(join(web, "index.html"), "<!doctype html><title>Preview</title>");
  writeFileSync(join(web, ".private"), "must-not-be-served");
  const server = createApplication({ database: ":memory:", webDir: web });
  try {
    await new Promise<void>((resolve) => server.http.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + (server.http.address() as { port: number }).port;
    for (const path of ["/host/ABC123", "/audience/ABC123", "/cast"]) {
      const response = await fetch(base + path);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("<title>Preview</title>");
    }
    expect((await fetch(base + "/api/missing")).status).toBe(404);
    expect(await (await fetch(base + "/.private")).text()).not.toContain("must-not-be-served");
  } finally {
    await server.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
