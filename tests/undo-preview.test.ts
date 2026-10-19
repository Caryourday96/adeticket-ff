import { expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Store } from "../apps/server/src/store";
import { createGame, audience } from "@naija/game";
import { setupSchema, type Command } from "@naija/contracts";
import { starterBank, fastQuestions } from "@naija/content";
it("undo preview follows persisted stack, rejects stale actions and stays out of audience data", () => {
  const dir = mkdtempSync(join(tmpdir(), "undo-preview-")),
    path = join(dir, "db.sqlite");
  let store = new Store(path);
  try {
    const setup = setupSchema.parse({
      teams: [
        { name: "One", members: ["Ada"], captain: 0 },
        { name: "Two", members: ["Bola"], captain: 0 },
      ],
      questionIds: starterBank.questions.map((q) => q.id),
    });
    store.add(
      createGame("ABCDEF", setup, starterBank.questions, fastQuestions, starterBank.notice),
    );
    const act = (command: Command) =>
      store.apply("ABCDEF", { id: randomUUID(), revision: store.host("ABCDEF").revision, command });
    act({ type: "openQuestion" });
    act({ type: "pause" });
    expect(store.host("ABCDEF").undoDescription).toBe("Pause game");
    const old = store.host("ABCDEF");
    act({ type: "undo" });
    expect(store.host("ABCDEF").undoDescription).toBe("Reveal the question");
    expect(() =>
      store.apply("ABCDEF", {
        id: randomUUID(),
        revision: old.revision,
        command: { type: "undo" },
      }),
    ).toThrow("game changed");
    store.close();
    store = new Store(path);
    expect(store.host("ABCDEF").undoDescription).toBe("Reveal the question");
    expect(audience(store.host("ABCDEF"))).not.toHaveProperty("undoDescription");
    act({ type: "undo" });
    expect(store.host("ABCDEF").canUndo).toBe(false);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
