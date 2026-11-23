import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { starterBank, fastQuestions } from "@naija/content";
import { setupSchema, type Command, type Side } from "@naija/contracts";
import { createGame } from "@naija/game";
import { Buzzers } from "../apps/server/src/buzzers";
import { Store } from "../apps/server/src/store";

it("selects the earliest eligible phone per team without opening buzzers or replacing manual picks", () => {
  const store = new Store(":memory:");
  try {
    const id = "JOINED";
    const setup = setupSchema.parse({
      teams: [
        { name: "Lagos", members: ["Ada", "Zuri", "Bea", "Pending"], captain: 0 },
        { name: "Abuja", members: ["Chi", "Dee"], captain: 0 },
      ],
      questionIds: starterBank.questions.map((question) => question.id),
    });
    const game = createGame(id, setup, starterBank.questions, fastQuestions, starterBank.notice);
    store.add({ ...game, lobby: true });
    const buzzers = new Buzzers(store);
    const register = (team: Side, name: string) => {
      const token = buzzers.register(id, team, name);
      return { token, id: store.player(id, token)!.id };
    };
    const waiting = register(0, "Pending");
    const zuri = register(0, "Zuri");
    const bea = register(0, "Bea");
    const ada = register(0, "Ada");
    const dee = register(1, "Dee");
    const chi = register(1, "Chi");
    for (const player of [bea, ada, zuri, chi, dee]) buzzers.control(id, "approve", player.id);
    expect(store.players(id).map((player) => player.name)).toEqual([
      "Pending",
      "Zuri",
      "Bea",
      "Ada",
      "Dee",
      "Chi",
    ]);
    const staged = () =>
      store
        .players(id)
        .filter((p) => p.onStage === true)
        .map((p) => p.name);
    const act = (command: Command) =>
      store.apply(id, { id: randomUUID(), revision: store.host(id).revision, command });
    buzzers.control(id, "autoStage");
    expect(staged()).toEqual(["Zuri", "Dee"]);
    expect(store.host(id).turns).toEqual([1, 1]);
    expect(store.host(id).teams.map((team) => team.captain)).toEqual([0, 0]);
    expect(store.host(id).questionRevealed).toBe(false);
    expect(buzzers.public(id).armed).toBe(false);
    expect(() => buzzers.control(id, "arm")).toThrow("waiting face-off");

    buzzers.control(id, "stage", ada.id);
    const late = register(0, "Late");
    buzzers.control(id, "approve", late.id);
    buzzers.control(id, "autoStage");
    expect(staged()).toEqual(["Ada", "Dee"]);
    act({ type: "startGame" });
    act({ type: "openQuestion" });
    expect(buzzers.public(id).armed).toBe(false);
    buzzers.control(id, "arm");
    expect(staged()).toEqual(["Ada", "Dee"]);
    const active = buzzers.public(id);
    expect(() => buzzers.control(id, "autoStage")).toThrow("locked");
    buzzers.control(id, "arm");
    expect(buzzers.public(id)).toEqual(active);

    buzzers.control(id, "bench", zuri.id);
    buzzers.control(id, "bench", ada.id);
    expect(buzzers.public(id).armed).toBe(false);
    buzzers.control(id, "arm");
    expect(staged()).toEqual(["Bea", "Dee"]);
    const epoch = buzzers.public(id).epoch;
    expect(() => buzzers.buzz(id, waiting.token, epoch)).toThrow("Host approval");
    expect(() => buzzers.buzz(id, ada.token, epoch)).toThrow("stage");
    expect(() => buzzers.buzz(id, chi.token, epoch)).toThrow("stage");
    buzzers.buzz(id, bea.token, epoch);
    expect(buzzers.public(id).winner).toEqual({ team: 0, name: "Bea" });
    expect(() => buzzers.control(id, "autoStage")).toThrow("before play");
  } finally {
    store.close();
  }
});
