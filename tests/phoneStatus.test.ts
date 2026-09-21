import { expect, it } from "vitest";
import type { HostState, HostBuzzers } from "@naija/contracts";
import { phoneStatus } from "../apps/web/src/lib/phoneStatus";

it("never presents an unavailable, unapproved, benched or wrong-turn phone as able to buzz", () => {
  const s = {
    teams: [
      { name: "Lagos", members: ["Ada", "Bola"] },
      { name: "Abuja", members: ["Chidi"] },
    ],
    turns: [0, 0],
    phase: "faceoff",
    face: { first: null },
    paused: false,
  } as unknown as HostState;
  const data: HostBuzzers = {
    epoch: "test",
    armed: true,
    winner: null,
    players: [
      {
        id: "p",
        team: 0,
        member: 0,
        name: "Ada",
        approved: true,
        onStage: true,
        connection: "ready",
      },
    ],
  };
  expect(phoneStatus(s, data, true)[0].ready).toBe(true);
  expect(phoneStatus(s, data, false)[0].ready).toBe(false);
  expect(phoneStatus(s, data, true)[1].message).toBe("No phone registered");
  for (const patch of [
    { approved: false },
    { onStage: false },
    { connection: "away" },
    { connection: "offline" },
    { name: "Old name" },
    { member: 1 },
  ]) {
    const changed = structuredClone(data);
    Object.assign(changed.players[0], patch);
    expect(phoneStatus(s, changed, true)[0].ready).toBe(false);
  }
  expect(phoneStatus({ ...s, paused: true }, data, true)[0].ready).toBe(false);
  expect(phoneStatus(s, { ...data, armed: false }, true)[0].message).toBe(
    "Ready when buzzers open",
  );
});
