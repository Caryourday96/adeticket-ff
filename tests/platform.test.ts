import { afterEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Platform, type Principal } from "../apps/server/src/platform";

// Synthetic credentials belong only to these isolated test databases.
const testPassword = "local-platform-test-only-123";
const databases: DatabaseSync[] = [];
const folders: string[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function database(path = ":memory:") {
  const db = new DatabaseSync(path);
  databases.push(db);
  return db;
}
async function fixture() {
  const db = database();
  const platform = new Platform(db);
  await platform.bootstrap("owner@example.test", testPassword);
  const ownerToken = (await platform.login("owner@example.test", testPassword))!;
  const owner = platform.principal(ownerToken)!;
  const a = platform.createGroup(owner, "Group A");
  const b = platform.createGroup(owner, "Group B");
  return { db, platform, owner, ownerToken, a, b };
}
async function member(
  platform: Platform,
  owner: Principal,
  group: string,
  email: string,
  role: "admin" | "host" = "admin",
) {
  const invitation = platform.invite(owner, group, email, role);
  const token = await platform.acceptInvitation(invitation.token, email, testPassword);
  return { token, user: platform.principal(token)! };
}

describe("multi-group identities and resource policies", () => {
  it("preserves legacy content and provisions one explicit owner without default credentials", async () => {
    const db = database();
    db.exec(
      "CREATE TABLE games(id TEXT PRIMARY KEY,body TEXT); CREATE TABLE packs(id TEXT PRIMARY KEY,body TEXT); CREATE TABLE surveys(id TEXT PRIMARY KEY,body TEXT); CREATE TABLE sessions(hash TEXT PRIMARY KEY,expires INTEGER);",
    );
    const saved = JSON.stringify({
      question: "Original question",
      answers: ["Original answer"],
      scores: [120, 90],
    });
    db.prepare("INSERT INTO games VALUES (?,?)").run("LEGACY", saved);
    db.prepare("INSERT INTO packs VALUES (?,?)").run("saved-bank", "unchanged bank");
    db.prepare("INSERT INTO surveys VALUES (?,?)").run("saved-survey", "unchanged responses");
    db.prepare("INSERT INTO sessions VALUES (?,?)").run("old-session", Date.now() + 999999);
    const platform = new Platform(db);
    expect(platform.enabled()).toBe(false);
    expect(await platform.login("owner@example.test", testPassword)).toBeNull();
    expect(platform.resourceGroup("game", "LEGACY")).toBe("legacy");
    expect(platform.resourceGroup("pack", "saved-bank")).toBe("legacy");
    expect(platform.resourceGroup("survey", "saved-survey")).toBe("legacy");
    await platform.bootstrap("OWNER@example.test", testPassword);
    expect(platform.enabled()).toBe(true);
    expect(db.prepare("SELECT body FROM games WHERE id='LEGACY'").get()?.body).toBe(saved);
    expect(db.prepare("SELECT count(*) AS n FROM sessions").get()?.n).toBe(0);
    await expect(platform.bootstrap("another@example.test", testPassword)).rejects.toThrow(
      "owner already exists",
    );
    const token = (await platform.login("owner@example.test", testPassword))!;
    expect(platform.principal(token)?.superAdmin).toBe(true);
    const serialized = JSON.stringify(db.prepare("SELECT * FROM platform_users").all());
    expect(serialized).not.toContain(testPassword);
    expect(serialized).toContain("scrypt$");
    expect(JSON.stringify(db.prepare("SELECT * FROM platform_sessions").all())).not.toContain(
      token,
    );
  });

  it("isolates groups and restricts hosts to assigned games, including roles that differ across groups", async () => {
    const { platform, owner, a, b } = await fixture();
    const adminA = await member(platform, owner, a.id, "a@example.test");
    const adminB = await member(platform, owner, b.id, "b@example.test");
    const host = await member(platform, owner, a.id, "host@example.test", "host");
    platform.assignResource("game", "A-GAME", a.id);
    platform.assignResource("game", "A-OTHER", a.id);
    platform.assignResource("game", "B-GAME", b.id);
    platform.assignResource("pack", "A-PACK", a.id);
    platform.assignResource("survey", "A-SURVEY", a.id);
    expect(platform.canReadResource(adminA.user, "game", "A-GAME")).toBe(true);
    expect(platform.canReadResource(adminB.user, "game", "A-GAME")).toBe(false);
    expect(platform.canReadResource(adminB.user, "pack", "A-PACK")).toBe(false);
    expect(platform.canReadResource(adminB.user, "survey", "A-SURVEY")).toBe(false);
    expect(platform.canReadResource(adminA.user, "pack", "starter")).toBe(true);
    expect(platform.canReadResource(host.user, "pack", "starter")).toBe(false);
    expect(platform.canReadResource(host.user, "game", "A-GAME")).toBe(false);
    platform.assignHost(adminA.user, "A-GAME", host.user.id);
    expect(platform.canReadResource(host.user, "game", "A-GAME")).toBe(true);
    expect(platform.canReadResource(host.user, "game", "A-OTHER")).toBe(false);
    expect(() => platform.assignHost(adminA.user, "B-GAME", host.user.id)).toThrow();
    expect(() => platform.createGroup(adminA.user, "Forbidden")).toThrow();
    expect(() => platform.users(adminA.user)).toThrow();
    expect(() => platform.auditLog(adminA.user, b.id)).toThrow();
    expect(() => platform.setMember(adminA.user, a.id, adminB.user.id, "admin")).toThrow("Invite");
    platform.setMember(owner, b.id, host.user.id, "admin");
    expect(platform.canReadResource(host.user, "game", "B-GAME")).toBe(true);
    expect(platform.canReadResource(host.user, "game", "A-OTHER")).toBe(false);
    expect(platform.canReadResource(owner, "game", "does-not-exist")).toBe(false);
    expect(() => platform.assignResource("game", "A-GAME", b.id)).toThrow("ownership");
  });

  it("requires the invited email, expires invitations, revokes replaced links, and consumes a token once even under a race", async () => {
    const { db, platform, owner, a } = await fixture();
    const old = platform.invite(owner, a.id, "invitee@example.test", "admin");
    const invitation = platform.invite(owner, a.id, "invitee@example.test", "admin");
    expect(() => platform.invitationInfo(old.token)).toThrow("invalid or expired");
    expect(JSON.stringify(db.prepare("SELECT * FROM platform_invitations").all())).not.toContain(
      invitation.token,
    );
    await expect(
      platform.acceptInvitation(invitation.token, "other@example.test", testPassword),
    ).rejects.toThrow("invited email");
    const attempts = await Promise.allSettled([
      platform.acceptInvitation(invitation.token, "invitee@example.test", testPassword),
      platform.acceptInvitation(invitation.token, "invitee@example.test", testPassword),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(() => platform.invitationInfo(invitation.token)).toThrow("invalid or expired");
    const expired = platform.invite(owner, a.id, "expired@example.test", "host");
    db.prepare("UPDATE platform_invitations SET expires=? WHERE id=?").run(
      Date.now() - 1,
      expired.id,
    );
    expect(() => platform.invitationInfo(expired.token)).toThrow("invalid or expired");
    const revoked = platform.invite(owner, a.id, "revoked@example.test", "host");
    platform.revokeInvitation(owner, revoked.id);
    await expect(
      platform.acceptInvitation(revoked.token, "revoked@example.test", testPassword),
    ).rejects.toThrow("invalid or expired");
  });

  it("does not reset an existing account through another invitation and rechecks account changes during acceptance", async () => {
    const { platform, owner, a, b } = await fixture();
    const account = await member(platform, owner, a.id, "existing@example.test");
    const second = platform.invite(owner, b.id, "existing@example.test", "host");
    await expect(
      platform.acceptInvitation(second.token, "existing@example.test", "wrong-password-long"),
    ).rejects.toThrow("existing account password");
    const token = await platform.acceptInvitation(
      second.token,
      "existing@example.test",
      testPassword,
    );
    expect(platform.principal(token)?.id).toBe(account.user.id);
    expect(
      platform
        .groups(account.user)
        .map((g) => g.role)
        .sort(),
    ).toEqual(["admin", "host"]);
    expect(platform.principal(token)?.superAdmin).toBe(false);
    const pending = platform.invite(account.user, a.id, "race@example.test", "host");
    const accepting = platform.acceptInvitation(pending.token, "race@example.test", testPassword);
    platform.setMember(owner, a.id, account.user.id, "host", true);
    await expect(accepting).rejects.toThrow("invalid or expired");
  });

  it("immediately revokes live permission and outstanding invitations when an administrator loses their role", async () => {
    const { platform, owner, a } = await fixture();
    const admin = await member(platform, owner, a.id, "admin@example.test");
    const pending = platform.invite(admin.user, a.id, "pending@example.test", "admin");
    platform.assignResource("game", "ADMIN-GAME", a.id);
    expect(platform.canReadResource(admin.user, "game", "ADMIN-GAME")).toBe(true);
    platform.setMember(owner, a.id, admin.user.id, "host");
    expect(platform.canReadResource(admin.user, "game", "ADMIN-GAME")).toBe(false);
    expect(() => platform.invitationInfo(pending.token)).toThrow("invalid or expired");
    expect(() => platform.invite(admin.user, a.id, "new@example.test", "admin")).toThrow();
    platform.assignHost(owner, "ADMIN-GAME", admin.user.id);
    expect(platform.canReadResource(admin.user, "game", "ADMIN-GAME")).toBe(true);
    platform.setMember(owner, a.id, admin.user.id, "host", true);
    platform.setMember(owner, a.id, admin.user.id, "host");
    expect(platform.canReadResource(admin.user, "game", "ADMIN-GAME")).toBe(false);
  });

  it("suspends groups and accounts and prevents stale session or owner claims from bypassing current permissions", async () => {
    const { platform, owner, a } = await fixture();
    const admin = await member(platform, owner, a.id, "admin@example.test");
    platform.assignResource("game", "SUSPEND", a.id);
    const pending = platform.invite(admin.user, a.id, "later@example.test", "host");
    expect(() => platform.createGroup({ ...admin.user, superAdmin: true }, "Spoofed")).toThrow();
    platform.updateGroup(owner, a.id, { suspended: true });
    expect(platform.activeResource("game", "SUSPEND")).toBe(false);
    expect(platform.canReadResource(owner, "game", "SUSPEND")).toBe(false);
    expect(platform.canManageGroup(owner, a.id)).toBe(true);
    expect(() => platform.invitationInfo(pending.token)).toThrow("unavailable");
    platform.updateGroup(owner, a.id, { suspended: false });
    platform.suspendUser(owner, admin.user.id, true);
    expect(platform.principal(admin.token)).toBeNull();
    expect(platform.canReadResource(admin.user, "game", "SUSPEND")).toBe(false);
    expect(await platform.login("admin@example.test", testPassword)).toBeNull();
    expect(() => platform.invitationInfo(pending.token)).toThrow("invalid or expired");
    platform.suspendUser(owner, admin.user.id, false);
    expect(platform.principal(admin.token)).toBeNull();
    expect(() => platform.suspendUser(owner, owner.id, true)).toThrow("cannot be suspended");
  });

  it("recovers accounts with session revocation and keeps audit entries free of credentials", async () => {
    const { db, platform, owner, ownerToken, a } = await fixture();
    const invitation = platform.invite(owner, a.id, "audit@example.test", "host");
    await platform.recover("owner@example.test", "replacement-local-test-password");
    expect(platform.principal(ownerToken)).toBeNull();
    expect(await platform.login("owner@example.test", testPassword)).toBeNull();
    const newToken = (await platform.login(
      "owner@example.test",
      "replacement-local-test-password",
    ))!;
    expect(platform.principal(newToken)?.superAdmin).toBe(true);
    platform.logout(newToken);
    expect(platform.principal(newToken)).toBeNull();
    const audits = JSON.stringify(db.prepare("SELECT * FROM platform_audit").all());
    for (const secret of [
      testPassword,
      "replacement-local-test-password",
      invitation.token,
      ownerToken,
      newToken,
    ])
      expect(audits).not.toContain(secret);
    expect(audits).toContain("account.recover");
    expect(audits).toContain("account.logout");
    const expiring = (await platform.login(
      "owner@example.test",
      "replacement-local-test-password",
    ))!;
    db.exec("UPDATE platform_sessions SET expires=0");
    expect(platform.principal(expiring)).toBeNull();
  });

  it("persists identities, sessions and assignments through database reopen and supports atomic resource cleanup", async () => {
    const folder = mkdtempSync(join(tmpdir(), "showdown-platform-"));
    folders.push(folder);
    const path = join(folder, "test.sqlite");
    const first = database(path);
    const platform = new Platform(first);
    await platform.bootstrap("owner@example.test", testPassword);
    const token = (await platform.login("owner@example.test", testPassword))!;
    const owner = platform.principal(token)!;
    const group = platform.createGroup(owner, "Persistent group");
    const host = await member(platform, owner, group.id, "host@example.test", "host");
    first.exec("BEGIN IMMEDIATE");
    platform.assignResource("game", "PERSIST", group.id);
    first.exec("COMMIT");
    platform.assignHost(owner, "PERSIST", host.user.id);
    first.close();
    databases.splice(databases.indexOf(first), 1);
    const second = database(path);
    const restored = new Platform(second);
    expect(restored.principal(token)?.id).toBe(owner.id);
    expect(restored.canReadResource(host.user, "game", "PERSIST")).toBe(true);
    second.exec("BEGIN IMMEDIATE");
    restored.removeResource("game", "PERSIST");
    second.exec("COMMIT");
    expect(restored.canReadResource(host.user, "game", "PERSIST")).toBe(false);
    expect(restored.resourceIds("game", group.id)).toEqual([]);
    expect(restored.hosts(owner, group.id)).toEqual([]);
  });
});
