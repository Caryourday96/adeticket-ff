import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { starterBank, fastQuestions } from "@naija/content";
import { setupSchema, type BuzzerPlayer } from "@naija/contracts";
import { createGame } from "@naija/game";
import { Store } from "../apps/server/src/store";
import { replayFinishedGame } from "../apps/server/src/gameReplay";
import type { Principal } from "../apps/server/src/platform";

const password = "synthetic-replay-password-only";
const stores: Store[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const store of stores.splice(0)) store.close();
});
const legacyHost: Principal = { id: "legacy-host", email: "", superAdmin: true };
function tracked() {
  const store = new Store(":memory:");
  stores.push(store);
  return store;
}
function addSource(
  store: Store,
  groupId = "legacy",
  id = "ABC123",
  finished = true,
  rehearsal = false,
) {
  const setup = setupSchema.parse({
    teams: [
      { name: "Jollof", members: ["Ada", "Tobi"], captain: 1 },
      { name: "Suya", members: ["Zee", "Chidi"], captain: 0 },
    ],
    questionIds: starterBank.questions.map((q) => q.id),
    rules: { target: 500, includeStealAnswer: false, multipliers: [1, 2, 2, 3] },
  });
  const state = createGame(
    id,
    setup,
    [...starterBank.questions].reverse(),
    [...fastQuestions].reverse(),
    "Preserve this source notice",
  );
  state.minimumRounds = 3;
  state.audienceTheme = {
    preset: "birthday",
    title: "Synthetic party",
    subtitle: "Original theme",
  };
  state.audienceSoundEnabled = false;
  state.scores = [330, 190];
  state.rehearsal = rehearsal;
  store.withResource("game", groupId, () => {
    store.add(state);
    return { id, value: id };
  });
  if (finished) store.apply(id, { id: randomUUID(), revision: 0, command: { type: "endGame" } });
  return id;
}
async function fixture() {
  const store = tracked();
  await store.platform.bootstrap("replay-owner@example.test", password);
  const owner = store.platform.principal(
    (await store.platform.login("replay-owner@example.test", password))!,
  )!;
  const group = store.platform.createGroup(owner, "Replay group");
  const invitation = store.platform.invite(owner, group.id, "replay-host@example.test", "host");
  const host = store.platform.principal(
    await store.platform.acceptInvitation(invitation.token, invitation.email, password),
  )!;
  const source = addSource(store, group.id);
  store.platform.assignHost(owner, source, host.id);
  return { store, owner, group, host, source };
}

it("replays only the saved configuration and approved phones, preserving original history and a narrow host grant", async () => {
  const { store, owner, group, host, source } = await fixture();
  const approvedToken = randomUUID(),
    pendingToken = randomUUID();
  const approved: BuzzerPlayer = {
    id: randomUUID(),
    team: 0,
    member: 0,
    name: "Ada",
    approved: true,
    onStage: true,
  };
  store.addPlayer(source, approved, approvedToken);
  store.addPlayer(
    source,
    { id: randomUUID(), team: 1, member: 0, name: "Zee", approved: false },
    pendingToken,
  );
  const original = structuredClone(store.saved(source));
  const replay = replayFinishedGame(store, source, host);
  const fresh = store.saved(replay.id);
  expect(replay).toMatchObject({ created: true, groupId: group.id });
  expect(store.saved(source)).toEqual(original);
  expect(fresh.state).toMatchObject({
    lobby: true,
    phase: "faceoff",
    revision: 0,
    scores: [0, 0],
    round: 0,
    bank: 0,
    strikes: 0,
    winner: null,
    roundWinner: null,
    showAll: false,
    paused: false,
    fast: null,
    teams: original.state.teams,
    rules: original.state.rules,
    source: original.state.source,
    questions: original.state.questions,
    fastQuestions: original.state.fastQuestions,
    minimumRounds: 3,
    audienceTheme: original.state.audienceTheme,
    audienceSoundEnabled: false,
  });
  expect(fresh.undo).toEqual([]);
  expect(fresh.commands).toEqual([]);
  expect(fresh.state.scoreAdjustments).toBeUndefined();
  expect(fresh.state.roundResults).toBeUndefined();
  expect(store.players(replay.id)).toHaveLength(1);
  expect(store.player(replay.id, approvedToken)).toMatchObject({
    name: "Ada",
    team: 0,
    approved: true,
    onStage: false,
  });
  expect(store.player(replay.id, approvedToken)!.id).not.toBe(approved.id);
  expect(store.player(replay.id, pendingToken)).toBeNull();
  expect(store.platform.canReadResource(host, "game", replay.id)).toBe(true);
  expect(store.platform.canManageGroup(host, group.id)).toBe(false);
  expect(store.platform.groups(host)).toMatchObject([{ id: group.id, role: "host" }]);
  expect(store.platform.canReadResource(host, "pack", "starter")).toBe(false);
  expect(
    store.platform.hosts(owner, group.id).filter((assignment) => assignment.gameId === replay.id),
  ).toMatchObject([{ gameId: replay.id, userId: host.id }]);
  expect(replayFinishedGame(store, source, host)).toEqual({ ...replay, created: false });
  expect(store.list()).toHaveLength(2);
  expect(store.players(replay.id)).toHaveLength(1);
});

it("rejects cross-group, unassigned, revoked, suspended, unfinished and rehearsal source games", async () => {
  const { store, owner, group, host, source } = await fixture();
  const otherGroup = store.platform.createGroup(owner, "Other group");
  const otherSource = addSource(store, otherGroup.id, "BBBBBB");
  const unassigned = addSource(store, group.id, "CCCCCC");
  expect(() => replayFinishedGame(store, otherSource, host)).toThrow("access");
  expect(() => replayFinishedGame(store, unassigned, host)).toThrow("access");
  expect(() => replayFinishedGame(store, source, null)).toThrow("Sign in");
  expect(() => replayFinishedGame(store, source, legacyHost)).toThrow("access");
  const unfinished = addSource(store, group.id, "DDDDDD", false);
  const rehearsal = addSource(store, group.id, "EEEEEE", true, true);
  expect(() => replayFinishedGame(store, unfinished, owner)).toThrow(
    "Finish the previous real game",
  );
  expect(() => replayFinishedGame(store, rehearsal, owner)).toThrow(
    "Finish the previous real game",
  );
  store.platform.assignHost(owner, source, host.id, true);
  expect(() => replayFinishedGame(store, source, host)).toThrow("access");
  store.platform.assignHost(owner, source, host.id);
  store.platform.updateGroup(owner, group.id, { suspended: true });
  expect(() => replayFinishedGame(store, source, host)).toThrow("access");
  expect(() => replayFinishedGame(store, source, owner)).toThrow("access");
  expect(store.nextGame(source)).toBeNull();
});

it("rechecks existing successor authorization rather than silently restoring a revoked host grant", async () => {
  const { store, owner, group, host, source } = await fixture();
  const replay = replayFinishedGame(store, source, host);
  store.platform.assignHost(owner, replay.id, host.id, true);
  expect(store.platform.canReadResource(host, "game", source)).toBe(true);
  expect(() => replayFinishedGame(store, source, host)).toThrow("next game exists");
  expect(store.platform.canReadResource(host, "game", replay.id)).toBe(false);
  expect(store.platform.canManageGroup(host, group.id)).toBe(false);
  expect(replayFinishedGame(store, source, owner)).toEqual({ ...replay, created: false });
  expect(store.list()).toHaveLength(2);
});

it("rolls back the new game, phone copies and successor link when carrying the host grant fails", async () => {
  const { store, owner, group, host, source } = await fixture();
  const original = structuredClone(store.saved(source));
  const spy = vi.spyOn(store.platform, "carryReplayHost").mockImplementation(() => {
    throw new Error("Synthetic assignment failure");
  });
  expect(() => replayFinishedGame(store, source, host)).toThrow("Synthetic assignment failure");
  expect(store.list()).toHaveLength(1);
  expect(store.platform.resourceIds("game", group.id)).toEqual([source]);
  expect(store.platform.hosts(owner, group.id)).toHaveLength(1);
  expect(store.nextGame(source)).toBeNull();
  expect(store.saved(source)).toEqual(original);
  spy.mockRestore();
  expect(replayFinishedGame(store, source, host).created).toBe(true);
});

it("allows owners and group admins to replay without granting a host new group privileges, and retains legacy authentication", async () => {
  const { store, owner, group, host, source } = await fixture();
  store.platform.setMember(owner, group.id, host.id, "admin");
  expect(replayFinishedGame(store, source, host).created).toBe(true);
  const another = addSource(store, group.id, "EEEEFF");
  expect(replayFinishedGame(store, another, owner).created).toBe(true);
  const legacy = tracked();
  const legacySource = addSource(legacy);
  expect(() => replayFinishedGame(legacy, legacySource, host)).toThrow("Sign in");
  const replay = replayFinishedGame(legacy, legacySource, legacyHost);
  expect(replay).toMatchObject({ created: true, groupId: "legacy" });
  expect(legacy.saved(replay.id).state.lobby).toBe(true);
  expect(replayFinishedGame(legacy, legacySource, legacyHost)).toEqual({
    ...replay,
    created: false,
  });
});
