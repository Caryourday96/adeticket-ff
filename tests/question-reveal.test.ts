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

it("reveals on buzzer opening, persists through restart, and hides the next round", () => {
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
    buzzers.control(game.id, "arm");
    expect(view().question.prompt).toBe(starterBank.questions[0].prompt);
    expect(buzzers.public(game.id).armed).toBe(true);
    buzzers.control(game.id, "lock");
    expect(view().question.prompt).toBe(starterBank.questions[0].prompt);
    store.close();
    store = new Store(path);
    buzzers = new Buzzers(store);
    expect(view().question.prompt).toBe(starterBank.questions[0].prompt);
    expect(buzzers.public(game.id).armed).toBe(false);
    const settled = { ...store.host(game.id), phase: "settled" as const };
    const next = transition(settled, { type: "next" });
    expect(next.questionRevealed).toBe(false);
    expect(audience(next).question.prompt).toBe("Players to the stage");
    const legacy = { ...game };
    delete legacy.questionRevealed;
    expect(audience(legacy).question.prompt).toBe("Players to the stage");
    expect(() => transition({ ...game, paused: true }, { type: "openQuestion" })).toThrow("Resume");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
