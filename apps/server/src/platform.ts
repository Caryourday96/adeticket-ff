import type { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export type Principal = { id: string; email: string; superAdmin: boolean };
export type Group = {
  id: string;
  name: string;
  suspended: boolean;
  role: "owner" | "admin" | "host";
};
export type ResourceKind = "game" | "pack" | "survey";
type Role = "admin" | "host";
type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  super_admin: number;
  suspended: number;
};
type GroupRow = { id: string; name: string; suspended: number };
type InvitationRow = {
  id: string;
  group_id: string;
  email: string;
  role: Role;
  token_hash: string;
  expires: number;
  revoked: number;
  used: number;
  created_by: string | null;
};
export class PlatformError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message);
  }
}
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(128);
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
async function matches(password: string, hash?: string) {
  const [, salt, expected] = (
    hash ?? "scrypt$00000000000000000000000000000000$" + "0".repeat(128)
  ).split("$");
  if (!/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(expected ?? "")) return false;
  const key = await derive(password, salt);
  return timingSafeEqual(key, Buffer.from(expected, "hex")) && !!hash;
}

/** All identities and permissions are read from this database, never from browser role claims.
 * SQLite has no RLS: scoped repository checks are the authorization boundary. One application process.
 */
export class Platform {
  constructor(private db: DatabaseSync) {
    db.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS platform_users(id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, super_admin INTEGER NOT NULL DEFAULT 0 CHECK(super_admin IN (0,1)), suspended INTEGER NOT NULL DEFAULT 0 CHECK(suspended IN (0,1)));
      CREATE TABLE IF NOT EXISTS platform_groups(id TEXT PRIMARY KEY, name TEXT NOT NULL, suspended INTEGER NOT NULL DEFAULT 0 CHECK(suspended IN (0,1)));
      CREATE TABLE IF NOT EXISTS platform_memberships(group_id TEXT NOT NULL REFERENCES platform_groups(id), user_id TEXT NOT NULL REFERENCES platform_users(id), role TEXT NOT NULL CHECK(role IN ('admin','host')), PRIMARY KEY(group_id,user_id));
      CREATE TABLE IF NOT EXISTS platform_sessions(hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES platform_users(id), expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS platform_invitations(id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES platform_groups(id), email TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','host')), token_hash TEXT NOT NULL UNIQUE, expires INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS platform_resources(kind TEXT NOT NULL CHECK(kind IN ('game','pack','survey')), id TEXT NOT NULL, group_id TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE INDEX IF NOT EXISTS platform_resources_group ON platform_resources(group_id,kind);
      CREATE TABLE IF NOT EXISTS platform_game_hosts(game_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES platform_users(id), PRIMARY KEY(game_id,user_id));
      CREATE TABLE IF NOT EXISTS platform_audit(id INTEGER PRIMARY KEY, at INTEGER NOT NULL, actor_id TEXT, action TEXT NOT NULL, group_id TEXT, target_id TEXT);
      INSERT OR IGNORE INTO platform_groups(id,name) VALUES ('legacy','Original Friends Showdown');
    `);
    if (
      !db
        .prepare("PRAGMA table_info(platform_invitations)")
        .all()
        .some((column) => column.name === "created_by")
    )
      db.exec(
        "ALTER TABLE platform_invitations ADD COLUMN created_by TEXT REFERENCES platform_users(id)",
      );
    // Add ownership without rewriting questions, scores, tokens, or original game snapshots.
    for (const [kind, table] of [
      ["game", "games"],
      ["pack", "packs"],
      ["survey", "surveys"],
    ] as const) {
      if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
        db.exec(
          `INSERT OR IGNORE INTO platform_resources(kind,id,group_id) SELECT '${kind}',id,'legacy' FROM ${table}`,
        );
    }
    for (const id of ["starter", "fast-starter", "ihechi-birthday"])
      db.prepare("INSERT OR IGNORE INTO platform_resources VALUES ('pack',?,'global')").run(id);
  }
  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  private user(id: string) {
    return this.db.prepare("SELECT * FROM platform_users WHERE id=?").get(id) as
      UserRow | undefined;
  }
  private byEmail(email: string) {
    return this.db.prepare("SELECT * FROM platform_users WHERE email=?").get(email) as
      UserRow | undefined;
  }
  private current(p: Principal) {
    const user = this.user(p.id);
    return user && !user.suspended ? user : null;
  }
  private isOwner(p: Principal) {
    return !!this.current(p)?.super_admin;
  }
  requireOwner(p: Principal) {
    if (!this.isOwner(p)) throw new PlatformError("Platform owner access required.");
  }
  enabled() {
    return !!this.db.prepare("SELECT 1 FROM platform_users LIMIT 1").get();
  }
  async bootstrap(email: string, password: string) {
    const normalized = emailSchema.parse(email),
      hash = await hashPassword(passwordSchema.parse(password));
    this.transaction(() => {
      if (this.enabled())
        throw new PlatformError("An owner already exists. Use the recovery command.", 409);
      const id = randomUUID();
      this.db
        .prepare("INSERT INTO platform_users(id,email,password_hash,super_admin) VALUES (?,?,?,1)")
        .run(id, normalized, hash);
      this.audit(null, "owner.bootstrap", "legacy", id);
      // Legacy shared host sessions must never become platform owner sessions.
      if (
        this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sessions'").get()
      )
        this.db.exec("DELETE FROM sessions");
    });
  }
  async recover(email: string, password: string) {
    const normalized = emailSchema.parse(email),
      hash = await hashPassword(passwordSchema.parse(password));
    this.transaction(() => {
      const user = this.byEmail(normalized);
      if (!user) throw new PlatformError("Account not found.", 404);
      this.db
        .prepare("UPDATE platform_users SET password_hash=?,suspended=0 WHERE id=?")
        .run(hash, user.id);
      this.db.prepare("DELETE FROM platform_sessions WHERE user_id=?").run(user.id);
      this.audit(null, "account.recover", null, user.id);
    });
  }
  private session(userId: string) {
    const token = randomBytes(32).toString("hex");
    this.db.prepare("DELETE FROM platform_sessions WHERE expires<=?").run(Date.now());
    this.db
      .prepare("INSERT INTO platform_sessions VALUES (?,?,?)")
      .run(digest(token), userId, Date.now() + 7 * 86400000);
    return token;
  }
  async login(email: string, password: string) {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success || typeof password !== "string" || password.length > 128) return null;
    const user = this.byEmail(parsed.data);
    if (!(await matches(password, user?.password_hash)) || !user) return null;
    return this.transaction(() => {
      const latest = this.user(user.id);
      if (!latest || latest.suspended || latest.password_hash !== user.password_hash) return null;
      const token = this.session(user.id);
      this.audit(user.id, "account.login", null, user.id);
      return token;
    });
  }
  principal(token?: string): Principal | null {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = this.db
      .prepare(
        "SELECT u.id,u.email,u.super_admin FROM platform_sessions s JOIN platform_users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>? AND u.suspended=0",
      )
      .get(digest(token), Date.now()) as
      { id: string; email: string; super_admin: number } | undefined;
    return row ? { id: row.id, email: row.email, superAdmin: !!row.super_admin } : null;
  }
  logout(token?: string) {
    if (!token) return;
    const user = this.principal(token);
    this.transaction(() => {
      this.db.prepare("DELETE FROM platform_sessions WHERE hash=?").run(digest(token));
      if (user) this.audit(user.id, "account.logout", null, user.id);
    });
  }
  private rowGroup(id: string) {
    return this.db.prepare("SELECT * FROM platform_groups WHERE id=?").get(id) as
      GroupRow | undefined;
  }
  private role(p: Principal, id: string): Role | null {
    if (!this.current(p)) return null;
    return (
      (
        this.db
          .prepare("SELECT role FROM platform_memberships WHERE group_id=? AND user_id=?")
          .get(id, p.id) as { role: Role } | undefined
      )?.role ?? null
    );
  }
  groups(p: Principal): Group[] {
    if (!this.current(p)) return [];
    const rows = this.isOwner(p)
      ? this.db.prepare("SELECT g.*, 'owner' AS role FROM platform_groups g ORDER BY name,id").all()
      : this.db
          .prepare(
            "SELECT g.*,m.role FROM platform_groups g JOIN platform_memberships m ON m.group_id=g.id WHERE m.user_id=? ORDER BY name,id",
          )
          .all(p.id);
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      suspended: !!r.suspended,
      role: r.role as Group["role"],
    }));
  }
  assertActiveGroup(id: string) {
    const group = this.rowGroup(id);
    if (!group || group.suspended) throw new PlatformError("This group is unavailable.", 403);
  }
  canManageGroup(p: Principal, id: string) {
    const group = this.rowGroup(id);
    return !!group && (this.isOwner(p) || (!group.suspended && this.role(p, id) === "admin"));
  }
  requireManager(p: Principal, id: string) {
    if (!this.canManageGroup(p, id))
      throw new PlatformError("Group administrator access required.");
  }
  createGroup(p: Principal, name: string) {
    this.requireOwner(p);
    name = z.string().trim().min(1).max(80).parse(name);
    const id = randomUUID();
    this.transaction(() => {
      this.db.prepare("INSERT INTO platform_groups(id,name) VALUES (?,?)").run(id, name);
      this.audit(p.id, "group.create", id, id);
    });
    return { id, name, suspended: false, role: "owner" as const };
  }
  updateGroup(p: Principal, id: string, input: { name?: string; suspended?: boolean }) {
    this.requireOwner(p);
    const current = this.rowGroup(id);
    if (!current) throw new PlatformError("Group not found.", 404);
    const body = z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        suspended: z.boolean().optional(),
      })
      .parse(input);
    this.transaction(() => {
      this.db
        .prepare("UPDATE platform_groups SET name=?,suspended=? WHERE id=?")
        .run(
          body.name ?? current.name,
          body.suspended === undefined ? current.suspended : Number(body.suspended),
          id,
        );
      this.audit(
        p.id,
        body.suspended === undefined
          ? "group.rename"
          : body.suspended
            ? "group.suspend"
            : "group.resume",
        id,
        id,
      );
    });
  }
  assignResource(kind: ResourceKind, id: string, groupId: string) {
    if (!(kind === "pack" && groupId === "global") && !this.rowGroup(groupId))
      throw new PlatformError("Group not found.", 404);
    const current = this.db
      .prepare("SELECT group_id FROM platform_resources WHERE kind=? AND id=?")
      .get(kind, id);
    if (current && current.group_id !== groupId)
      throw new PlatformError("Resource ownership cannot be changed by assignment.", 409);
    this.db
      .prepare("INSERT OR IGNORE INTO platform_resources(kind,id,group_id) VALUES (?,?,?)")
      .run(kind, id, groupId);
  }
  // Caller may already own a content-deletion transaction; never start another here.
  removeResource(kind: ResourceKind, id: string) {
    if (kind === "game") this.db.prepare("DELETE FROM platform_game_hosts WHERE game_id=?").run(id);
    this.db.prepare("DELETE FROM platform_resources WHERE kind=? AND id=?").run(kind, id);
  }
  resourceGroup(kind: ResourceKind, id: string): string {
    return String(
      this.db.prepare("SELECT group_id FROM platform_resources WHERE kind=? AND id=?").get(kind, id)
        ?.group_id ?? "legacy",
    );
  }
  resourceIds(kind: ResourceKind, groupId: string): string[] {
    return this.db
      .prepare("SELECT id FROM platform_resources WHERE kind=? AND group_id=? ORDER BY rowid DESC")
      .all(kind, groupId)
      .map((r) => String(r.id));
  }
  activeResource(kind: ResourceKind, id: string) {
    if (!this.db.prepare("SELECT 1 FROM platform_resources WHERE kind=? AND id=?").get(kind, id))
      return false;
    const group = this.resourceGroup(kind, id);
    return (
      (kind === "pack" && group === "global") ||
      (!!this.rowGroup(group) && !this.rowGroup(group)!.suspended)
    );
  }
  canReadResource(p: Principal, kind: ResourceKind, id: string) {
    if (!this.current(p) || !this.activeResource(kind, id)) return false;
    if (this.isOwner(p)) return true;
    const groupId = this.resourceGroup(kind, id);
    if (kind === "pack" && groupId === "global")
      return this.groups(p).some((g) => g.role === "admin" && !g.suspended);
    const role = this.role(p, groupId);
    if (role === "admin") return true;
    return (
      kind === "game" &&
      role === "host" &&
      !!this.db
        .prepare("SELECT 1 FROM platform_game_hosts WHERE game_id=? AND user_id=?")
        .get(id, p.id)
    );
  }
  members(p: Principal, groupId: string) {
    this.requireManager(p, groupId);
    return this.db
      .prepare(
        "SELECT u.id AS userId,u.email,m.role,u.suspended FROM platform_memberships m JOIN platform_users u ON u.id=m.user_id WHERE m.group_id=? ORDER BY u.email",
      )
      .all(groupId)
      .map((r) => ({ ...r, suspended: !!r.suspended }));
  }
  setMember(p: Principal, groupId: string, userId: string, role: Role, remove = false) {
    this.requireManager(p, groupId);
    if (!this.user(userId)) throw new PlatformError("Account not found.", 404);
    // Only the owner may directly assign another existing account. A group admin
    // must invite a new member, allowing that person to accept the membership.
    if (
      !this.isOwner(p) &&
      !this.db
        .prepare("SELECT 1 FROM platform_memberships WHERE group_id=? AND user_id=?")
        .get(groupId, userId)
    )
      throw new PlatformError("Invite this person to the group first.");
    role = z.enum(["admin", "host"]).parse(role);
    this.transaction(() => {
      if (remove)
        this.db
          .prepare("DELETE FROM platform_memberships WHERE group_id=? AND user_id=?")
          .run(groupId, userId);
      else
        this.db
          .prepare(
            "INSERT INTO platform_memberships VALUES (?,?,?) ON CONFLICT(group_id,user_id) DO UPDATE SET role=excluded.role",
          )
          .run(groupId, userId, role);
      // Removed membership cannot resurrect old game assignments on a later reinvitation.
      if (remove)
        this.db
          .prepare(
            "DELETE FROM platform_game_hosts WHERE user_id=? AND game_id IN (SELECT id FROM platform_resources WHERE kind='game' AND group_id=?)",
          )
          .run(userId, groupId);
      if (remove || role !== "admin")
        this.db
          .prepare(
            "UPDATE platform_invitations SET revoked=1 WHERE group_id=? AND created_by=? AND used=0",
          )
          .run(groupId, userId);
      this.audit(p.id, remove ? "membership.remove" : "membership.assign", groupId, userId);
    });
  }
  users(p: Principal) {
    this.requireOwner(p);
    return this.db
      .prepare("SELECT id,email,super_admin,suspended FROM platform_users ORDER BY email")
      .all()
      .map((r) => ({
        id: String(r.id),
        email: String(r.email),
        superAdmin: !!r.super_admin,
        suspended: !!r.suspended,
      }));
  }
  suspendUser(p: Principal, id: string, suspended: boolean) {
    this.requireOwner(p);
    const user = this.user(id);
    if (!user) throw new PlatformError("Account not found.", 404);
    if (user.super_admin) throw new PlatformError("The platform owner cannot be suspended.", 409);
    this.transaction(() => {
      this.db
        .prepare("UPDATE platform_users SET suspended=? WHERE id=?")
        .run(Number(suspended), id);
      if (suspended) this.db.prepare("DELETE FROM platform_sessions WHERE user_id=?").run(id);
      if (suspended)
        this.db
          .prepare("UPDATE platform_invitations SET revoked=1 WHERE created_by=? AND used=0")
          .run(id);
      this.audit(p.id, suspended ? "account.suspend" : "account.resume", null, id);
    });
  }
  invite(p: Principal, groupId: string, email: string, role: Role, hours = 48) {
    this.requireManager(p, groupId);
    this.assertActiveGroup(groupId);
    const normalized = emailSchema.parse(email),
      validRole = z.enum(["admin", "host"]).parse(role);
    const lifetime = z.number().min(1).max(168).parse(hours);
    const token = randomBytes(32).toString("hex"),
      id = randomUUID(),
      expiresAt = Date.now() + lifetime * 3600000;
    this.transaction(() => {
      this.db
        .prepare(
          "UPDATE platform_invitations SET revoked=1 WHERE group_id=? AND email=? AND used=0",
        )
        .run(groupId, normalized);
      this.db
        .prepare(
          "INSERT INTO platform_invitations(id,group_id,email,role,token_hash,expires,created_by) VALUES (?,?,?,?,?,?,?)",
        )
        .run(id, groupId, normalized, validRole, digest(token), expiresAt, p.id);
      this.audit(p.id, "invitation.create", groupId, id);
    });
    return { id, email: normalized, role: validRole, groupId, expiresAt, token };
  }
  invitations(p: Principal, groupId: string) {
    this.requireManager(p, groupId);
    return this.db
      .prepare(
        "SELECT id,email,role,group_id AS groupId,expires AS expiresAt,revoked,used FROM platform_invitations WHERE group_id=? ORDER BY rowid DESC",
      )
      .all(groupId)
      .map((r) => ({ ...r, revoked: !!r.revoked, used: !!r.used }));
  }
  revokeInvitation(p: Principal, id: string) {
    const row = this.db.prepare("SELECT * FROM platform_invitations WHERE id=?").get(id) as
      InvitationRow | undefined;
    if (!row) throw new PlatformError("Invitation not found.", 404);
    this.requireManager(p, row.group_id);
    this.transaction(() => {
      this.db.prepare("UPDATE platform_invitations SET revoked=1 WHERE id=?").run(id);
      this.audit(p.id, "invitation.revoke", row.group_id, id);
    });
  }
  private validInvite(token: string) {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      throw new PlatformError("This invitation is invalid or expired.", 400);
    const row = this.db
      .prepare(
        "SELECT * FROM platform_invitations WHERE token_hash=? AND revoked=0 AND used=0 AND expires>?",
      )
      .get(digest(token), Date.now()) as InvitationRow | undefined;
    if (!row) throw new PlatformError("This invitation is invalid or expired.", 400);
    this.assertActiveGroup(row.group_id);
    const issuer = row.created_by ? this.user(row.created_by) : undefined;
    if (
      !issuer ||
      !this.canManageGroup(
        { id: issuer.id, email: issuer.email, superAdmin: !!issuer.super_admin },
        row.group_id,
      )
    )
      throw new PlatformError("This invitation is invalid or expired.", 400);
    return row;
  }
  invitationInfo(token: string) {
    const row = this.validInvite(token);
    return {
      email: row.email,
      groupName: this.rowGroup(row.group_id)!.name,
      role: row.role,
      expiresAt: row.expires,
      existingAccount: !!this.byEmail(row.email),
    };
  }
  async acceptInvitation(token: string, email: string, password: string) {
    const normalized = emailSchema.parse(email),
      invitation = this.validInvite(token);
    if (normalized !== invitation.email)
      throw new PlatformError("Use the invited email address.", 400);
    if (typeof password !== "string" || password.length > 128)
      throw new PlatformError("Enter a valid password.", 400);
    const existing = this.byEmail(normalized);
    let passwordHash: string | undefined;
    if (existing) {
      if (existing.suspended || !(await matches(password, existing.password_hash)))
        throw new PlatformError(
          "Use your existing account password, or ask the owner for account recovery.",
          401,
        );
    } else passwordHash = await hashPassword(passwordSchema.parse(password));
    return this.transaction(() => {
      const current = this.validInvite(token),
        latest = this.byEmail(normalized);
      // Recheck after password hashing: invitation revocation/account change wins the race.
      if (
        current.email !== normalized ||
        !!latest !== !!existing ||
        (latest && (latest.suspended || latest.password_hash !== existing!.password_hash))
      )
        throw new PlatformError("The account changed. Please try again.", 409);
      const id = latest?.id ?? randomUUID();
      if (!latest)
        this.db
          .prepare("INSERT INTO platform_users(id,email,password_hash) VALUES (?,?,?)")
          .run(id, normalized, passwordHash!);
      this.db
        .prepare(
          "INSERT INTO platform_memberships VALUES (?,?,?) ON CONFLICT(group_id,user_id) DO UPDATE SET role=excluded.role",
        )
        .run(current.group_id, id, current.role);
      this.db.prepare("UPDATE platform_invitations SET used=1 WHERE id=?").run(current.id);
      this.audit(id, "invitation.accept", current.group_id, current.id);
      return this.session(id);
    });
  }
  assignHost(p: Principal, gameId: string, userId: string, remove = false) {
    const group = this.resourceGroup("game", gameId);
    this.requireManager(p, group);
    this.assertActiveGroup(group);
    if (!this.db.prepare("SELECT 1 FROM platform_resources WHERE kind='game' AND id=?").get(gameId))
      throw new PlatformError("Game not found.", 404);
    if (
      !remove &&
      !this.db
        .prepare(
          "SELECT 1 FROM platform_memberships m JOIN platform_users u ON u.id=m.user_id WHERE m.group_id=? AND m.user_id=? AND u.suspended=0",
        )
        .get(group, userId)
    )
      throw new PlatformError("Choose an active member of this group.", 400);
    this.transaction(() => {
      if (remove)
        this.db
          .prepare("DELETE FROM platform_game_hosts WHERE game_id=? AND user_id=?")
          .run(gameId, userId);
      else
        this.db
          .prepare("INSERT OR IGNORE INTO platform_game_hosts VALUES (?,?)")
          .run(gameId, userId);
      this.audit(p.id, remove ? "host.remove" : "host.assign", group, gameId);
    });
  }
  hosts(p: Principal, groupId: string) {
    this.requireManager(p, groupId);
    return this.db
      .prepare(
        "SELECT h.game_id AS gameId,h.user_id AS userId,u.email FROM platform_game_hosts h JOIN platform_resources r ON r.kind='game' AND r.id=h.game_id JOIN platform_users u ON u.id=h.user_id WHERE r.group_id=?",
      )
      .all(groupId);
  }
  audit(actorId: string | null, action: string, groupId: string | null, targetId: string | null) {
    this.db
      .prepare(
        "INSERT INTO platform_audit(at,actor_id,action,group_id,target_id) VALUES (?,?,?,?,?)",
      )
      .run(Date.now(), actorId, action, groupId, targetId);
  }
  auditLog(p: Principal, groupId?: string) {
    if (groupId) this.requireManager(p, groupId);
    else this.requireOwner(p);
    const columns =
      "SELECT id,at,actor_id AS actorId,action,group_id AS groupId,target_id AS targetId FROM platform_audit";
    return groupId
      ? this.db.prepare(columns + " WHERE group_id=? ORDER BY id DESC LIMIT 100").all(groupId)
      : this.db.prepare(columns + " ORDER BY id DESC LIMIT 100").all();
  }
  stats(p: Principal) {
    this.requireOwner(p);
    const n = (sql: string) => Number(this.db.prepare(sql).get()!.n);
    return {
      groups: n("SELECT count(*) AS n FROM platform_groups"),
      activeGroups: n("SELECT count(*) AS n FROM platform_groups WHERE suspended=0"),
      users: n("SELECT count(*) AS n FROM platform_users"),
      games: n("SELECT count(*) AS n FROM platform_resources WHERE kind='game'"),
    };
  }
}
