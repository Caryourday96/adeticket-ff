import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { transition } from "@naija/game";
import {
  bankSchema,
  type Bank,
  type Envelope,
  type GameState,
  type HostState,
  type BuzzerPlayer,
} from "@naija/contracts";
type Saved = { state: GameState; undo: GameState[]; history: string[]; commands: string[] };
export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS games(id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS packs(id TEXT PRIMARY KEY, body TEXT NOT NULL);",
    );
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY, game TEXT NOT NULL, hash TEXT NOT NULL, body TEXT NOT NULL)",
    );
  }
  players(game: string): BuzzerPlayer[] {
    return (
      this.db.prepare("SELECT body FROM players WHERE game=?").all(game) as { body: string }[]
    ).map((r) => JSON.parse(r.body));
  }
  player(game: string, token?: string): BuzzerPlayer | null {
    if (!token) return null;
    const row = this.db
      .prepare("SELECT body FROM players WHERE game=? AND hash=?")
      .get(game, this.hash(token)) as { body: string } | undefined;
    return row ? JSON.parse(row.body) : null;
  }
  addPlayer(game: string, player: BuzzerPlayer, token: string) {
    this.db
      .prepare("INSERT INTO players VALUES (?,?,?,?)")
      .run(player.id, game, this.hash(token), JSON.stringify(player));
  }
  updatePlayer(game: string, player: BuzzerPlayer) {
    this.db
      .prepare("UPDATE players SET body=? WHERE game=? AND id=?")
      .run(JSON.stringify(player), game, player.id);
  }
  removePlayer(game: string, id: string) {
    this.db.prepare("DELETE FROM players WHERE game=? AND id=?").run(game, id);
  }
  close() {
    this.db.close();
  }
  add(state: GameState) {
    this.db
      .prepare("INSERT INTO games(id,body) VALUES (?,?)")
      .run(state.id, JSON.stringify({ state, undo: [], history: ["Game created"], commands: [] }));
  }
  saved(id: string): Saved {
    const row = this.db.prepare("SELECT body FROM games WHERE id=?").get(id) as
      { body: string } | undefined;
    if (!row) throw new Error("Game not found.");
    return JSON.parse(row.body);
  }
  host(id: string): HostState {
    const r = this.saved(id);
    return { ...r.state, canUndo: r.undo.length > 0, history: r.history.slice(-12).reverse() };
  }
  list() {
    return (this.db.prepare("SELECT body FROM games").all() as { body: string }[])
      .map((r) => JSON.parse(r.body).state as GameState)
      .map((s) => ({
        id: s.id,
        teams: s.teams.map((t) => t.name),
        phase: s.phase,
        round: s.round + 1,
      }))
      .reverse();
  }
  expiredFastGames(now = Date.now()) {
    return (
      this.db
        .prepare(
          "SELECT id FROM games WHERE json_extract(body,'$.state.phase')='fast' AND json_extract(body,'$.state.fast.stage')='running' AND json_extract(body,'$.state.paused')=0 AND json_extract(body,'$.state.fast.deadline')<=?",
        )
        .all(now) as { id: string }[]
    ).map((r) => r.id);
  }
  apply(id: string, envelope: Envelope) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = this.saved(id);
      if (r.commands.includes(envelope.id)) {
        this.db.exec("COMMIT");
        return this.host(id);
      }
      if (r.state.revision !== envelope.revision)
        throw new Error("The game changed. Your screen has been refreshed; try again.");
      const revision = r.state.revision + 1;
      if (envelope.command.type === "undo") {
        const previous = r.undo.pop();
        if (!previous) throw new Error("Nothing to undo.");
        // Undoing a running timer restores its remaining duration rather than an expired deadline.
        if (previous.fast?.stage === "running" && previous.fast.deadline) {
          previous.fast.deadline = Date.now() + previous.fast.remaining;
        }
        r.state = previous;
      } else {
        const next = transition(r.state, envelope.command);
        const previous = structuredClone(r.state);
        if (previous.fast?.deadline)
          previous.fast.remaining = Math.max(0, previous.fast.deadline - Date.now());
        r.undo.push(previous);
        if (r.undo.length > 100) r.undo.shift();
        r.state = next;
      }
      r.state.revision = revision;
      r.commands.push(envelope.id);
      r.history.push(
        envelope.command.type +
          " · " +
          new Date().toLocaleTimeString("en-GB", { timeZone: "UTC" }) +
          " UTC",
      );
      this.db.prepare("UPDATE games SET body=? WHERE id=?").run(JSON.stringify(r), id);
      this.db.exec("COMMIT");
      return this.host(id);
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  session() {
    const token = randomBytes(32).toString("hex");
    this.db
      .prepare("INSERT INTO sessions(hash,expires) VALUES (?,?)")
      .run(this.hash(token), Date.now() + 7 * 86400000);
    return token;
  }
  authorized(token: string | undefined) {
    if (!token) return false;
    const r = this.db.prepare("SELECT expires FROM sessions WHERE hash=?").get(this.hash(token)) as
      { expires: number } | undefined;
    return !!r && r.expires > Date.now();
  }
  revoke(token: string) {
    this.db.prepare("DELETE FROM sessions WHERE hash=?").run(this.hash(token));
  }
  private hash(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
  packs() {
    return (
      this.db.prepare("SELECT id,body FROM packs").all() as { id: string; body: string }[]
    ).map((r) => ({ id: r.id, bank: bankSchema.parse(JSON.parse(r.body)) }));
  }
  pack(id: string) {
    return this.packs().find((p) => p.id === id)?.bank;
  }
  addPack(bank: Bank) {
    const id = randomBytes(8).toString("hex");
    this.db.prepare("INSERT INTO packs(id,body) VALUES (?,?)").run(id, JSON.stringify(bank));
    return id;
  }
}
