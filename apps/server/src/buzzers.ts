import { randomBytes, randomUUID } from "node:crypto";
import type { BuzzerState, Side } from "@naija/contracts";
import { Store } from "./store";

// Deliberately process-local: a restart always locks the buttons. Run one server instance.
export class Buzzers {
  private presence = new Map<string, { at: number; visible: boolean }>();
  heartbeat(id: string, token: string | undefined, visible: boolean, now = Date.now()) {
    const p = this.store.player(id, token);
    if (!p) throw new Error("Pair this phone first.");
    this.presence.set(p.id, { at: now, visible });
  }
  private gates = new Map<string, BuzzerState & { revision: number }>();
  constructor(private store: Store) {}
  forget(id: string, playerIds: string[]) {
    this.gates.delete(id);
    for (const playerId of playerIds) this.presence.delete(playerId);
  }
  simulate(id: string, team: Side, epoch: string) {
    const state = this.store.host(id);
    if (!state.rehearsal)
      throw new Error("Simulated contestants are only available in rehearsal games.");
    const token = randomBytes(32).toString("hex");
    const player = {
      id: randomUUID(),
      team,
      member: state.turns[team],
      name: state.teams[team].members[state.turns[team]],
      approved: true,
    };
    this.store.addPlayer(id, player, token);
    try {
      this.buzz(id, token, epoch);
    } finally {
      this.store.removePlayer(id, player.id);
    }
  }
  lock(id: string) {
    this.gates.set(id, {
      epoch: randomUUID(),
      armed: false,
      winner: null,
      revision: this.store.host(id).revision,
    });
  }
  public(id: string): BuzzerState {
    const s = this.store.host(id);
    if (!this.gates.has(id) || this.gates.get(id)!.revision !== s.revision) this.lock(id);
    const { epoch, armed, winner } = this.gates.get(id)!;
    return { epoch, armed, winner };
  }
  host(id: string, now = Date.now()) {
    return {
      ...this.public(id),
      players: this.store.players(id).map((p) => {
        const seen = this.presence.get(p.id);
        const connection: "ready" | "away" | "offline" =
          !seen || now - seen.at > 15000 ? "offline" : seen.visible ? "ready" : "away";
        return { ...p, connection };
      }),
    };
  }
  join(id: string, team: Side, member: number, oldToken?: string) {
    const s = this.store.host(id),
      name = s.teams[team].members[member];
    if (!name || s.phase === "finished") throw new Error("That roster place is unavailable.");
    const old = this.store.player(id, oldToken);
    if (
      this.store.players(id).some((p) => p.team === team && p.member === member && p.id !== old?.id)
    )
      throw new Error("This player already has a phone. Ask the host to remove it first.");
    if (old) this.store.removePlayer(id, old.id);
    const token = randomBytes(32).toString("hex");
    this.store.addPlayer(id, { id: randomUUID(), team, member, name, approved: false }, token);
    return token;
  }
  control(id: string, action: string, playerId?: string) {
    const s = this.store.host(id);
    if (action === "arm") {
      if (s.paused || s.phase !== "faceoff" || s.face.first !== null)
        throw new Error("Buzzers can only open for a waiting face-off.");
      this.lock(id);
      this.gates.get(id)!.armed = true;
    } else if (action === "lock") this.lock(id);
    else {
      const p = this.store.players(id).find((p) => p.id === playerId);
      if (!p) throw new Error("Phone registration not found.");
      if (action === "remove") this.store.removePlayer(id, p.id);
      else {
        if (s.teams[p.team].members[p.member] !== p.name)
          throw new Error("The roster changed. Remove this phone and join again.");
        this.store.updatePlayer(id, { ...p, approved: true });
      }
      this.lock(id);
    }
  }
  buzz(id: string, token: string | undefined, epoch: string) {
    const p = this.store.player(id, token),
      s = this.store.host(id),
      gate = this.public(id);
    if (!p?.approved) throw new Error("Host approval required.");
    if (s.teams[p.team].members[p.member] !== p.name || s.turns[p.team] !== p.member)
      throw new Error("It is another player's face-off turn.");
    if (
      !gate.armed ||
      gate.epoch !== epoch ||
      s.paused ||
      s.phase !== "faceoff" ||
      s.face.first !== null
    )
      throw new Error("Buzzers are locked. Wait for the host.");
    // No async gap: only the first accepted request can advance the revision.
    const next = this.store.apply(id, {
      id: randomUUID(),
      revision: s.revision,
      command: { type: "buzz", team: p.team },
    });
    this.gates.set(id, {
      epoch: randomUUID(),
      armed: false,
      winner: { team: p.team, name: p.name },
      revision: next.revision,
    });
  }
}
