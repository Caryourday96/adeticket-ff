// Isolated synthetic accounts only. Never points at the owner's DATA_DIR.
import { mkdtempSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
mkdirSync(".data", { recursive: true });
const directory = mkdtempSync(resolve(".data/platform-e2e-"));
const env = {
  ...process.env,
  NODE_ENV: "test",
  DATA_DIR: directory,
  FF_ADMIN_EMAIL: "owner@example.test",
  FF_ADMIN_PASSWORD: "synthetic-owner-password",
};
const bootstrap = spawnSync(process.execPath, ["dist/admin.cjs", "bootstrap"], {
  env,
  stdio: "inherit",
});
if (bootstrap.status !== 0) process.exit(bootstrap.status ?? 1);
Object.assign(process.env, {
  NODE_ENV: "test",
  DATA_DIR: directory,
  PORT: "3117",
  APP_ORIGIN: "http://127.0.0.1:3117",
});
delete process.env.HOST_PASSWORD;
delete process.env.FF_ADMIN_EMAIL;
delete process.env.FF_ADMIN_PASSWORD;
await import("../dist/server.cjs");
