import { randomBytes, randomUUID } from "node:crypto";
import type { BuzzerPlayer, BuzzerState, HostState, Side } from "@naija/contracts";
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
    if (s.joinsLocked) throw new Error("The host has locked new joins.");
    if (!name || s.teams[team].awaitingPlayers || ["fast", "finished"].includes(s.phase))
      throw new Error("That roster place is unavailable.");
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
  register(id: string, team: Side, rawName: string, oldToken?: string) {
    const s = this.store.host(id);
    if (s.joinsLocked) throw new Error("The host has locked new joins.");
    const name = rawName.trim();
    if (!name || name.length > 100 || ["fast", "finished"].includes(s.phase))
      throw new Error("Player registration is unavailable.");
    const old = this.store.player(id, oldToken);
    if (old)
      throw new Error(
        "This phone is already registered. Ask the host to remove it before changing players.",
      );
    const players = this.store.players(id);
    if (players.filter((p) => p.team === team).length >= 12)
      throw new Error("This team already has 12 phone registrations.");
    if (
      players.some(
        (p) => p.team === team && p.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      throw new Error(
        "That name is already registered on this team. Add an initial to distinguish yourself.",
      );
    const member = s.teams[team].awaitingPlayers
      ? -1
      : s.teams[team].members.findIndex((m) => m.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (member < 0 && !s.teams[team].awaitingPlayers && s.teams[team].members.length >= 12)
      throw new Error("This team's roster is full.");
    const token = randomBytes(32).toString("hex");
    this.store.addPlayer(
      id,
      {
        id: randomUUID(),
        team,
        member,
        name: member < 0 ? name : s.teams[team].members[member],
        approved: false,
        onStage: false,
      },
      token,
    );
    return token;
  }
  private stage(id: string, state: HostState, player: BuzzerPlayer, manual: boolean) {
    if (
      !player.approved ||
      state.teams[player.team].awaitingPlayers ||
      state.teams[player.team].members[player.member] !== player.name
    )
      throw new Error("Approve this player and check their roster place first.");
    if (manual || state.turns[player.team] !== player.member)
      this.store.apply(id, {
        id: randomUUID(),
        revision: state.revision,
        command: { type: "faceoffPlayer", team: player.team, member: player.member },
      });
    for (const other of this.store.players(id).filter((other) => other.team === player.team)) {
      const onStage = other.id === player.id;
      this.store.updatePlayer(id, {
        ...other,
        onStage,
        autoStageBenchedRound: onStage ? undefined : other.autoStageBenchedRound,
      });
    }
  }
  private fillFaceoffStage(id: string) {
    for (const team of [0, 1] as const) {
      const state = this.store.host(id);
      if (state.teams[team].awaitingPlayers) continue;
      const eligible = this.store
        .players(id)
        .filter(
          (player) =>
            player.team === team &&
            player.approved &&
            player.autoStageBenchedRound !== state.round &&
            state.teams[team].members[player.member] === player.name,
        );
      if (eligible.some((player) => player.onStage === true && state.turns[team] === player.member))
        continue;
      const firstJoin = eligible[0];
      if (firstJoin) this.stage(id, state, firstJoin, false);
    }
  }
  control(id: string, action: string, playerId?: string) {
    const s = this.store.host(id);
    if (action === "arm") {
      if (s.lobby || s.paused || s.phase !== "faceoff" || s.face.first !== null)
        throw new Error("Buzzers can only open for a waiting face-off.");
      if (s.questionRevealed !== true)
        throw new Error("Reveal the question, then read it aloud before opening buzzers.");
      if (this.public(id).armed) return;
      this.fillFaceoffStage(id);
      this.lock(id);
      this.gates.get(id)!.armed = true;
    } else if (action === "autoStage") {
      if (s.paused || s.phase !== "faceoff" || s.face.first !== null || this.public(id).armed)
        throw new Error("Select face-off captains while the buzzers are locked before play.");
      this.fillFaceoffStage(id);
      this.lock(id);
    } else if (action === "lock") this.lock(id);
    else if (action === "removeAll") {
      for (const p of this.store.players(id)) this.store.removePlayer(id, p.id);
      this.lock(id);
    } else {
      const p = this.store.players(id).find((p) => p.id === playerId);
      if (!p) throw new Error("Phone registration not found.");
      if (action === "remove") this.store.removePlayer(id, p.id);
      else if (action === "bench")
        this.store.updatePlayer(id, { ...p, onStage: false, autoStageBenchedRound: s.round });
      else if (action === "stage") this.stage(id, s, p, true);
      else {
        const teams = structuredClone(s.teams);
        const t = teams[p.team];
        const matches = t.awaitingPlayers
          ? []
          : t.members.flatMap((name, index) =>
              name.toLocaleLowerCase() === p.name.toLocaleLowerCase() ? [index] : [],
            );
        if (matches.length > 1)
          throw new Error(
            "Give duplicate roster names distinct initials before approving this phone.",
          );
        if (matches.length === 1) {
          p.member = matches[0];
          p.name = t.members[p.member];
          if (
            this.store
              .players(id)
              .some(
                (other) => other.id !== p.id && other.team === p.team && other.member === p.member,
              )
          )
            throw new Error(
              "This roster place already has a phone. Remove the other registration first.",
            );
        } else {
          if (t.awaitingPlayers) {
            t.members = [];
            t.awaitingPlayers = false;
          }
          if (t.members.length >= 12) throw new Error("This team's roster is full.");
          p.member = t.members.length;
          t.members.push(p.name);
          this.store.apply(id, {
            id: randomUUID(),
            revision: s.revision,
            command: { type: "roster", teams },
          });
        }
        if (this.store.host(id).teams[p.team].members[p.member] !== p.name)
          throw new Error("The roster changed. Remove this phone and join again.");
        // Preserve legacy roster-phone staging; roster reconciliation already clears changed seats.
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
    if (p.onStage === false) throw new Error("Wait for the host to put you on stage.");
    if (s.teams[p.team].members[p.member] !== p.name || s.turns[p.team] !== p.member)
      throw new Error("It is another player's face-off turn.");
    if (
      !gate.armed ||
      gate.epoch !== epoch ||
      s.questionRevealed !== true ||
      s.lobby ||
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
