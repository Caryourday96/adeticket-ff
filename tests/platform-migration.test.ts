import { expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { starterBank, fastQuestions } from "@naija/content";
import { setupSchema, type Command, type GameState, type BuzzerPlayer } from "@naija/contracts";
import { createGame, transition } from "@naija/game";
import { Surveys } from "../apps/server/src/surveys";
import { Store } from "../apps/server/src/store";

const password = "synthetic-migration-test-only-123";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const setup = setupSchema.parse({
  teams: [
    { name: "Legacy Jollof", members: ["Synthetic Ada", "Synthetic Tobi"], captain: 0 },
    { name: "Legacy Suya", members: ["Synthetic Zee", "Synthetic Chidi"], captain: 0 },
  ],
  questionIds: starterBank.questions.map((q) => q.id),
});

it("migrates a populated legacy database in place, preserves actual content and undo, and keeps new tenant ownership after reopen", async () => {
  const folder = mkdtempSync(join(tmpdir(), "showdown-migration-"));
  const path = join(folder, "showdown.sqlite");
  let legacy: DatabaseSync | undefined;
  let store: Store | undefined;
  try {
    // This schema intentionally has no platform, ownership, or remote-answer tables.
    legacy = new DatabaseSync(path);
    legacy.exec(`
      CREATE TABLE games(id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE sessions(hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      CREATE TABLE packs(id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE players(id TEXT PRIMARY KEY, game TEXT NOT NULL, hash TEXT NOT NULL, body TEXT NOT NULL);
    `);
    let state = createGame(
      "ABCDEF",
      setup,
      starterBank.questions,
      fastQuestions,
      "Synthetic legacy bank",
    );
    const undo: GameState[] = [],
      commands: string[] = [],
      history = ["Game created"];
    function legacyApply(command: Command) {
      undo.push(structuredClone(state));
      const revision = state.revision + 1;
      state = transition(state, command, 1700000000000);
      // Old snapshots predate the new optional turn/lobby fields.
      delete state.answerTurnRevision;
      delete state.lobby;
      state.revision = revision;
      state.lastCommand = command.type;
      commands.push(randomUUID());
      history.push(command.type + " · synthetic history");
    }
    legacyApply({ type: "buzz", team: 0 });
    legacyApply({ type: "answer", answerId: starterBank.questions[0].answers[0].id });
    legacyApply({ type: "choice", pass: false });
    for (const answer of starterBank.questions[0].answers.slice(1))
      legacyApply({ type: "answer", answerId: answer.id });
    expect(state.phase).toBe("settled");
    expect(state.scores[0]).toBeGreaterThan(0);
    const saved = { state, undo, commands, history };
    const savedJson = JSON.stringify(saved);
    legacy.prepare("INSERT INTO games VALUES (?,?)").run(state.id, savedJson);
    const bank = { ...starterBank, title: "Preserved custom legacy bank" };
    legacy.prepare("INSERT INTO packs VALUES (?,?)").run("legacy-pack", JSON.stringify(bank));
    const phoneToken = randomUUID(),
      hostToken = randomUUID();
    const player: BuzzerPlayer = {
      id: randomUUID(),
      team: 0,
      member: 0,
      name: setup.teams[0].members[0],
      approved: true,
      onStage: true,
    };
    legacy
      .prepare("INSERT INTO players VALUES (?,?,?,?)")
      .run(player.id, state.id, hash(phoneToken), JSON.stringify(player));
    legacy.prepare("INSERT INTO sessions VALUES (?,?)").run(hash(hostToken), Date.now() + 600000);
    const surveys = new Surveys(legacy);
    const survey = surveys.create({
      title: "Preserved legacy responses",
      roundType: "regular",
      questions: Array.from({ length: 5 }, (_, i) => ({
        prompt: `Synthetic migration question ${i + 1}?`,
      })),
    });
    surveys.submit(survey.id, "synthetic-respondent", {
      answers: { q1: "Preserved answer", q2: "Another answer" },
    });
    surveys.setOpen(survey.id, false, surveys.get(survey.id).revision);
    const surveyResults = surveys.results(survey.id);
    legacy.close();
    legacy = undefined;

    store = new Store(path);
    expect(store.platform.enabled()).toBe(false);
    expect(store.authorized(hostToken)).toBe(true);
    expect(store.saved(state.id)).toEqual(saved);
    expect(store.player(state.id, phoneToken)).toEqual(player);
    expect(store.pack("legacy-pack")).toEqual(bank);
    expect(store.surveys.results(survey.id)).toEqual(surveyResults);
    for (const [kind, id] of [
      ["game", state.id],
      ["pack", "legacy-pack"],
      ["survey", survey.id],
    ] as const)
      expect(store.platform.resourceGroup(kind, id)).toBe("legacy");

    await store.platform.bootstrap("migration-owner@example.test", password);
    expect(store.authorized(hostToken)).toBe(false);
    const ownerToken = (await store.platform.login("migration-owner@example.test", password))!;
    const owner = store.platform.principal(ownerToken)!;
    const group = store.platform.createGroup(owner, "New independent group");
    const invitation = store.platform.invite(
      owner,
      group.id,
      "migration-admin@example.test",
      "admin",
    );
    const adminToken = await store.platform.acceptInvitation(
      invitation.token,
      invitation.email,
      password,
    );
    const admin = store.platform.principal(adminToken)!;
    const next = {
      ...createGame("BBCCDD", setup, starterBank.questions, fastQuestions, "New tenant bank"),
      lobby: true,
    };
    store.withResource("game", group.id, () => {
      store!.add(next);
      return { id: next.id, value: next.id };
    });
    store.apply(next.id, { id: randomUUID(), revision: 0, command: { type: "startGame" } });
    store.apply(next.id, { id: randomUUID(), revision: 1, command: { type: "buzz", team: 1 } });
    const newSaved = store.saved(next.id);
    expect(store.platform.canReadResource(admin, "game", next.id)).toBe(true);
    expect(store.platform.canReadResource(admin, "game", state.id)).toBe(false);
    expect(store.saved(state.id)).toEqual(saved);
    store.close();
    store = undefined;

    // Repeat constructor migrations and check actual records, not only identity table counts.
    store = new Store(path);
    expect(store.platform.principal(ownerToken)?.id).toBe(owner.id);
    expect(store.platform.principal(adminToken)?.id).toBe(admin.id);
    expect(store.saved(state.id)).toEqual(saved);
    expect(store.saved(next.id)).toEqual(newSaved);
    expect(store.platform.resourceGroup("game", next.id)).toBe(group.id);
    expect(store.platform.canReadResource(admin, "game", next.id)).toBe(true);
    expect(store.platform.canReadResource(admin, "game", state.id)).toBe(false);
    expect(store.platform.canReadResource(admin, "pack", "legacy-pack")).toBe(false);
    expect(store.platform.canReadResource(admin, "survey", survey.id)).toBe(false);
    expect(store.player(state.id, phoneToken)).toEqual(player);
    expect(store.pack("legacy-pack")).toEqual(bank);
    expect(store.surveys.results(survey.id)).toEqual(surveyResults);
    expect(store.host(state.id).canUndo).toBe(true);
    const restored = store.apply(state.id, {
      id: randomUUID(),
      revision: state.revision,
      command: { type: "undo" },
    });
    expect(restored.scores).toEqual(undo.at(-1)!.scores);
    expect(restored.revealed).toEqual(undo.at(-1)!.revealed);
    expect(restored.questions).toEqual(state.questions);
    expect(restored.fastQuestions).toEqual(state.fastQuestions);
    expect(store.saved(next.id)).toEqual(newSaved);
  } finally {
    store?.close();
    legacy?.close();
    // Remove only the isolated temporary database directory created by this test.
    if (
      resolve(folder).startsWith(resolve(tmpdir()) + "\\showdown-migration-") ||
      resolve(folder).startsWith(resolve(tmpdir()) + "/showdown-migration-")
    )
      rmSync(folder, { recursive: true, force: true });
  }
});
