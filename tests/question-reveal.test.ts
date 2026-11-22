import { expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Store } from "../apps/server/src/store";
import { Buzzers } from "../apps/server/src/buzzers";
import { createGame, audience, transition } from "@naija/game";
import { setupSchema } from "@naija/contracts";
import { starterBank, fastQuestions } from "@naija/content";

it("reveals a question with locked buzzers and opens only on a second host action", () => {
  const dir = mkdtempSync(join(tmpdir(), "reveal-")),
    path = join(dir, "game.sqlite");
  let store = new Store(path);
  try {
    const setup = setupSchema.parse({
      teams: [
        { name: "One", members: ["Ada"], captain: 0 },
        { name: "Two", members: ["Bola"], captain: 0 },
      ],
      questionIds: starterBank.questions.map((q) => q.id),
    });
    const game = createGame(
      "ABCDEF",
      setup,
      starterBank.questions,
      fastQuestions,
      starterBank.notice,
    );
    store.add(game);
    let buzzers = new Buzzers(store);
    const view = () => audience(store.host(game.id));
    const act = (command: Parameters<typeof transition>[1]) =>
      store.apply(game.id, { id: randomUUID(), revision: store.host(game.id).revision, command });
    expect(view().question.prompt).toBe("Players to the stage");
    const staged = {
      id: randomUUID(),
      team: 0 as const,
      member: 0,
      name: "Ada",
      approved: true,
      onStage: false,
    };
    store.addPlayer(game.id, staged, "private-test-token");
    buzzers.control(game.id, "stage", staged.id);
    expect(view().question.prompt).toBe("Players to the stage");
    expect(store.host(game.id).questions[0].prompt).toBe(starterBank.questions[0].prompt);
    const hiddenGate = buzzers.public(game.id);
    expect(() => buzzers.control(game.id, "arm")).toThrow("Reveal the question");
    expect(buzzers.public(game.id)).toEqual(hiddenGate);
    act({ type: "openQuestion" });
    expect(view().question.prompt).toBe(starterBank.questions[0].prompt);
    const readingGate = buzzers.public(game.id);
    expect(readingGate.armed).toBe(false);
    expect(() => buzzers.buzz(game.id, "private-test-token", readingGate.epoch)).toThrow("locked");
    buzzers.control(game.id, "arm");
    expect(buzzers.public(game.id).armed).toBe(true);
    expect(() => act({ type: "openQuestion" })).toThrow("already revealed");
    expect(buzzers.public(game.id).armed).toBe(true);
    expect(() => buzzers.buzz(game.id, "private-test-token", readingGate.epoch)).toThrow("locked");
    act({ type: "pause" });
    expect(buzzers.public(game.id).armed).toBe(false);
    expect(() => buzzers.control(game.id, "arm")).toThrow("waiting face-off");
    act({ type: "pause" });
    expect(buzzers.public(game.id).armed).toBe(false);
    buzzers.control(game.id, "arm");
    buzzers.control(game.id, "lock");
    expect(view().question.prompt).toBe(starterBank.questions[0].prompt);
    store.close();
    store = new Store(path);
    buzzers = new Buzzers(store);
    expect(view().question.prompt).toBe(starterBank.questions[0].prompt);
    expect(buzzers.public(game.id).armed).toBe(false);
    buzzers.control(game.id, "arm");
    buzzers.buzz(game.id, "private-test-token", buzzers.public(game.id).epoch);
    expect(buzzers.public(game.id)).toMatchObject({
      armed: false,
      winner: { team: 0, name: "Ada" },
    });
    act({ type: "answer", answerId: starterBank.questions[0].answers[0].id });
    act({ type: "choice", pass: false });
    for (const answer of starterBank.questions[0].answers.slice(1)) {
      act({ type: "answer", answerId: answer.id });
    }
    const next = act({ type: "next" });
    expect(next.questionRevealed).toBe(false);
    expect(audience(next).question.prompt).toBe("Players to the stage");
    expect(buzzers.public(game.id).armed).toBe(false);
    expect(() => buzzers.control(game.id, "arm")).toThrow("Reveal the question");
    const legacy = { ...game };
    delete legacy.questionRevealed;
    expect(audience(legacy).question.prompt).toBe("Players to the stage");
    expect(() => transition({ ...game, paused: true }, { type: "openQuestion" })).toThrow("Resume");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
