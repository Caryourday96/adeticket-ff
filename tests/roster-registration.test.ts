import { afterEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Store } from "../apps/server/src/store";
import { Buzzers } from "../apps/server/src/buzzers";
import { answerEligibility } from "../apps/server/src/remotePlay";
import { createGame } from "@naija/game";
import { starterBank, fastBank } from "@naija/content";
import { setupSchema, type Command } from "@naija/contracts";

const stores: Store[] = [];
afterEach(() => {
  stores.splice(0).forEach((s) => s.close());
});
function fixture(duplicates = false) {
  const store = new Store(":memory:");
  stores.push(store);
  const setup = setupSchema.parse({
    teams: [
      { name: "Lagos", members: ["Ada", "Tobi"], captain: 0 },
      { name: "Abuja", members: [duplicates ? "Tobi" : "Bola"], captain: 0 },
    ],
    questionIds: starterBank.questions.map((q) => q.id),
  });
  store.add(createGame("ABC123", setup, starterBank.questions, fastBank.questions, "fixture"));
  const buzzers = new Buzzers(store),
    token = buzzers.register("ABC123", 0, "Tobi");
  const id = store.player("ABC123", token)!.id;
  buzzers.control("ABC123", "approve", id);
  const act = (command: Command) =>
    store.apply("ABC123", { id: randomUUID(), revision: store.host("ABC123").revision, command });
  return { store, buzzers, token, id, act };
}

it("keeps a unique phone paired through reorder, team move and Undo; clears staging and old buzzer epoch", () => {
  const { store, buzzers, token, id, act } = fixture();
  buzzers.control("ABC123", "stage", id);
  buzzers.control("ABC123", "arm");
  const epoch = buzzers.public("ABC123").epoch;
  let teams = structuredClone(store.host("ABC123").teams);
  teams[0].members = ["Tobi", "Ada"];
  act({ type: "roster", teams });
  expect(store.player("ABC123", token)).toMatchObject({
    id,
    member: 0,
    team: 0,
    approved: true,
    onStage: false,
  });
  expect(buzzers.public("ABC123").armed).toBe(false);
  expect(() => buzzers.buzz("ABC123", token, epoch)).toThrow();
  act({ type: "undo" });
  expect(store.player("ABC123", token)).toMatchObject({
    member: 1,
    team: 0,
    approved: true,
    onStage: false,
  });
  teams = structuredClone(store.host("ABC123").teams);
  teams[0].members = ["Ada"];
  teams[1].members.push("Tobi");
  act({ type: "roster", teams });
  expect(store.player("ABC123", token)).toMatchObject({ member: 1, team: 1, approved: true });
  buzzers.control("ABC123", "stage", id);
  buzzers.control("ABC123", "arm");
  buzzers.buzz("ABC123", token, buzzers.public("ABC123").epoch);
  expect(answerEligibility(store.host("ABC123"), store.player("ABC123", token))).toBeNull();
});

it("unapproves removed identities and does not silently restore approval on Undo", () => {
  const { store, buzzers, token, id, act } = fixture();
  const teams = structuredClone(store.host("ABC123").teams);
  teams[0].members = ["Ada", "Chidi"];
  act({ type: "roster", teams });
  expect(store.player("ABC123", token)).toMatchObject({
    name: "Tobi",
    member: -1,
    approved: false,
  });
  expect(() => buzzers.control("ABC123", "stage", id)).toThrow();
  act({ type: "undo" });
  expect(store.player("ABC123", token)?.approved).toBe(false);
  buzzers.control("ABC123", "approve", id);
  expect(store.player("ABC123", token)).toMatchObject({ name: "Tobi", member: 1, approved: true });
});

it("does not bench the first team when approving a new player on the other team", () => {
  const { store, buzzers, token, id } = fixture();
  buzzers.control("ABC123", "stage", id);
  const second = buzzers.register("ABC123", 1, "New player");
  buzzers.control("ABC123", "approve", store.player("ABC123", second)!.id);
  expect(store.player("ABC123", token)).toMatchObject({ approved: true, onStage: true, member: 1 });
  buzzers.control("ABC123", "arm");
  expect(() => buzzers.buzz("ABC123", token, buzzers.public("ABC123").epoch)).not.toThrow();
});

it("keeps staging after a team rename but requires review for an ambiguous move", () => {
  const { store, buzzers, token, id, act } = fixture(true);
  buzzers.control("ABC123", "stage", id);
  const teams = structuredClone(store.host("ABC123").teams);
  teams[0].name = "Renamed team";
  act({ type: "roster", teams });
  expect(store.player("ABC123", token)?.approved).toBe(true);
  expect(store.player("ABC123", token)?.onStage).toBe(true);
  teams[0].members = ["Tobi", "Ada"];
  act({ type: "roster", teams });
  expect(store.player("ABC123", token)).toMatchObject({
    member: -1,
    approved: false,
    onStage: false,
  });
  const competing = buzzers.join("ABC123", 0, 0);
  expect(() => buzzers.control("ABC123", "approve", id)).toThrow(/already has a phone/);
  expect(store.player("ABC123", competing)?.approved).toBe(false);
});
