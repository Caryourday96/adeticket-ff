import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setupSchema, type Command, type GameState, type BuzzerPlayer } from "@naija/contracts";
import { starterBank, fastQuestions } from "@naija/content";
import { audience, createGame, transition } from "@naija/game";
import { Store } from "../apps/server/src/store";
import { answerEligibility } from "../apps/server/src/remotePlay";

const stores: Store[] = [];
const folders: string[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function fresh(): GameState {
  return createGame(
    "AABBCC",
    setupSchema.parse({
      teams: [
        { name: "Jollof", members: ["Ada", "Tobi"], captain: 0 },
        { name: "Suya", members: ["Zee", "Femi"], captain: 1 },
      ],
      questionIds: starterBank.questions.map((q) => q.id),
    }),
    starterBank.questions,
    fastQuestions,
    starterBank.notice,
  );
}
function tracked(path = ":memory:") {
  const store = new Store(path);
  stores.push(store);
  return store;
}
function apply(store: Store, command: Command) {
  return store.apply("AABBCC", {
    id: randomUUID(),
    revision: store.host("AABBCC").revision,
    command,
  });
}
function addPlayer(store: Store, team: 0 | 1, member = 0, approved = true) {
  const player: BuzzerPlayer = {
    id: randomUUID(),
    team,
    member,
    name: store.host("AABBCC").teams[team].members[member],
    approved,
    onStage: true,
  };
  const token = randomUUID();
  store.addPlayer("AABBCC", player, token);
  return { player, token };
}
function guess(store: Store, token: string, text = "My own guess") {
  const input = { id: randomUUID(), revision: store.host("AABBCC").revision, text };
  return { input, answer: store.remotePlay.submit("AABBCC", token, input) };
}

describe("online lobby", () => {
  it("requires a host start, conceals content, and preserves legacy games", () => {
    const old = fresh();
    expect(transition(old, { type: "buzz", team: 0 }).face.first).toBe(0);
    const lobby = { ...old, lobby: true };
    for (const command of [
      { type: "openQuestion" },
      { type: "buzz", team: 0 },
      { type: "answer", answerId: "a1" },
      { type: "miss" },
      { type: "next" },
      { type: "showAll" },
    ] as Command[])
      expect(() => transition(lobby, command)).toThrow("Start the game");
    const publicState = audience({ ...lobby, showAll: true, revealed: ["a1"] });
    expect(publicState.question.prompt).toBe("Waiting for the host to start");
    expect(publicState.question.answers.every((a) => a.text === null && a.points === null)).toBe(
      true,
    );
    expect(JSON.stringify(publicState)).not.toContain(starterBank.questions[0].answers[0].text);
    const started = transition(lobby, { type: "startGame" });
    expect(started.lobby).toBe(false);
    expect(audience(started).question.id).toBe("waiting");
    expect(() => transition(started, { type: "startGame" })).toThrow("already started");
  });

  it("allows lobby roster preparation and ending but not starting incomplete/paused teams", () => {
    const state = { ...fresh(), lobby: true };
    state.teams[0].awaitingPlayers = true;
    expect(() => transition(state, { type: "startGame" })).toThrow("Approve at least");
    state.teams[0].awaitingPlayers = false;
    expect(transition(state, { type: "faceoffPlayer", team: 0, member: 1 }).turns[0]).toBe(1);
    expect(() => transition({ ...state, paused: true }, { type: "startGame" })).toThrow("Resume");
    expect(transition(state, { type: "endGame" }).lobby).toBe(false);
  });

  it("undoing start restores the lobby without rewriting saved scores", () => {
    const store = tracked();
    store.add({ ...fresh(), lobby: true });
    apply(store, { type: "startGame" });
    expect(store.host("AABBCC").lobby).toBe(false);
    apply(store, { type: "undo" });
    expect(store.host("AABBCC").lobby).toBe(true);
    expect(store.host("AABBCC").scores).toEqual([0, 0]);
  });
});

describe("private remote guesses", () => {
  it("accepts only the approved active player and never scores or publishes a guess", () => {
    const store = tracked();
    store.add(fresh());
    const ada = addPlayer(store, 0),
      zee = addPlayer(store, 1),
      pending = addPlayer(store, 0, 1, false);
    expect(() => guess(store, ada.token)).toThrow("Buzz in first");
    apply(store, { type: "buzz", team: 0 });
    expect(() => guess(store, zee.token)).toThrow("another player's");
    expect(() => guess(store, pending.token)).toThrow("approval");
    expect(() => guess(store, "wrong-cookie")).toThrow("approval");
    const accepted = guess(store, ada.token, "  A private synthetic guess  ");
    expect(accepted.answer.text).toBe("A private synthetic guess");
    expect(store.remotePlay.hostView("AABBCC").answers).toEqual([accepted.answer]);
    expect(store.remotePlay.playerView("AABBCC", zee.token).submission).toBeNull();
    expect(store.host("AABBCC").scores).toEqual([0, 0]);
    expect(store.host("AABBCC").revealed).toEqual([]);
    expect(JSON.stringify(audience(store.host("AABBCC")))).not.toContain(accepted.answer.text);
  });

  it("deduplicates exact retries and rejects changed IDs, stale writes and extra guesses", () => {
    const store = tracked();
    store.add(fresh());
    const ada = addPlayer(store, 0);
    apply(store, { type: "buzz", team: 0 });
    const { input, answer } = guess(store, ada.token);
    expect(store.remotePlay.submit("AABBCC", ada.token, input)).toEqual(answer);
    expect(() =>
      store.remotePlay.submit("AABBCC", ada.token, { ...input, text: "Changed" }),
    ).toThrow("request ID");
    expect(() => guess(store, ada.token)).toThrow("already sent");
    apply(store, { type: "miss" });
    expect(() =>
      store.remotePlay.submit("AABBCC", ada.token, { ...input, id: randomUUID() }),
    ).toThrow("game changed");
    // A duplicate accepted request is a receipt, never another score/action after moving on.
    expect(store.remotePlay.submit("AABBCC", ada.token, input)).toEqual(answer);
    expect(store.remotePlay.hostView("AABBCC").answers).toEqual([]);
  });

  it("keeps a sent guess during pause/theme changes without allowing another guess", () => {
    const store = tracked();
    store.add(fresh());
    const ada = addPlayer(store, 0);
    apply(store, { type: "buzz", team: 0 });
    const { answer } = guess(store, ada.token);
    apply(store, { type: "pause" });
    expect(store.remotePlay.playerView("AABBCC", ada.token).eligible).toBe(false);
    expect(store.remotePlay.hostView("AABBCC").answers).toEqual([answer]);
    apply(store, { type: "pause" });
    apply(store, {
      type: "audienceTheme",
      theme: { preset: "classic", title: "Party", subtitle: "" },
    });
    expect(store.remotePlay.playerView("AABBCC", ada.token).submission).toEqual(answer);
    expect(() => guess(store, ada.token, "Another guess")).toThrow("already sent");
  });

  it("opens a new answer opportunity when an unsuccessful face-off cycles back to a player", () => {
    const store = tracked();
    store.add(fresh());
    const ada = addPlayer(store, 0);
    apply(store, { type: "buzz", team: 0 });
    guess(store, ada.token, "First attempt");
    apply(store, { type: "miss" });
    apply(store, { type: "miss" });
    apply(store, { type: "buzz", team: 0 });
    apply(store, { type: "miss" });
    apply(store, { type: "miss" });
    apply(store, { type: "buzz", team: 0 });
    expect(store.host("AABBCC").turns[0]).toBe(0);
    expect(store.remotePlay.hostView("AABBCC").answers).toEqual([]);
    expect(guess(store, ada.token, "Fresh attempt").answer.text).toBe("Fresh attempt");
  });

  it("checks the next regular player, steal captain, staging, roster and pause restrictions", () => {
    const store = tracked();
    store.add(fresh());
    const ada = addPlayer(store, 0),
      tobi = addPlayer(store, 0, 1),
      zee = addPlayer(store, 1),
      femi = addPlayer(store, 1, 1);
    apply(store, { type: "buzz", team: 0 });
    expect(answerEligibility(store.host("AABBCC"), { ...ada.player, onStage: false })).toContain(
      "stage",
    );
    expect(answerEligibility(store.host("AABBCC"), { ...ada.player, name: "Changed" })).toContain(
      "roster",
    );
    apply(store, { type: "answer", answerId: "a1" });
    apply(store, { type: "choice", pass: false });
    expect(() => guess(store, ada.token)).toThrow("another player's");
    guess(store, tobi.token);
    apply(store, { type: "miss" });
    apply(store, { type: "miss" });
    apply(store, { type: "miss" });
    expect(store.host("AABBCC").phase).toBe("steal");
    expect(() => guess(store, zee.token)).toThrow("another player's");
    expect(guess(store, femi.token).answer.team).toBe(1);
  });

  it("restores accepted guesses after restart and cleans them on game deletion", () => {
    const folder = mkdtempSync(join(tmpdir(), "showdown-remote-"));
    folders.push(folder);
    const path = join(folder, "test.sqlite"),
      store = tracked(path);
    store.add(fresh());
    const ada = addPlayer(store, 0);
    apply(store, { type: "buzz", team: 0 });
    const { answer } = guess(store, ada.token);
    stores.splice(stores.indexOf(store), 1);
    store.close();
    const restarted = tracked(path);
    expect(restarted.remotePlay.playerView("AABBCC", ada.token).submission).toEqual(answer);
    expect(restarted.remotePlay.hostView("AABBCC").answers).toEqual([answer]);
    restarted.remotePlay.forget("AABBCC");
    expect(restarted.remotePlay.hostView("AABBCC").answers).toEqual([]);
  });
});
