import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Platform } from "./platform";

/** Operator-only bootstrap/recovery. Password never appears in command arguments or output. */
async function main() {
  const command = process.argv[2];
  if (command !== "bootstrap" && command !== "recover")
    throw new Error(
      "Usage: node dist/admin.cjs bootstrap|recover. Set DATA_DIR, FF_ADMIN_EMAIL and FF_ADMIN_PASSWORD privately first.",
    );
  if (process.env.NODE_ENV === "production" && !process.env.DATA_DIR)
    throw new Error("DATA_DIR must identify the production persistent directory.");
  const email = process.env.FF_ADMIN_EMAIL,
    password = process.env.FF_ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error(
      "Set FF_ADMIN_EMAIL and FF_ADMIN_PASSWORD privately. No password is accepted in arguments.",
    );
  const directory = resolve(process.env.DATA_DIR ?? ".data");
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(resolve(directory, "showdown.sqlite"));
  db.exec("PRAGMA busy_timeout=5000");
  try {
    const platform = new Platform(db);
    if (command === "bootstrap") await platform.bootstrap(email, password);
    else await platform.recover(email, password);
    console.log(
      command === "bootstrap"
        ? "Owner account provisioned. Remove the temporary credential environment variables before starting the app."
        : "Account password reset and previous sessions revoked. Remove temporary credential environment variables.",
    );
  } finally {
    db.close();
    delete process.env.FF_ADMIN_PASSWORD;
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Account operation failed.");
  process.exitCode = 1;
});
