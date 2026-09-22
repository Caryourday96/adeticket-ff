import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { audienceThemes, commandSchema } from "@naija/contracts";
import { audience, transition } from "@naija/game";
import { createRehearsal } from "../apps/server/src/rehearsal";
import { Store } from "../apps/server/src/store";

it("publishes themes while paused without altering scores, answers or the clock", () => {
  const initial = createRehearsal("THEMES", "fast");
  initial.paused = true;
  const updated = transition(initial, { type: "audienceTheme", theme: audienceThemes.birthday });
  expect(updated).toEqual({ ...initial, audienceTheme: audienceThemes.birthday });
  expect(initial.audienceTheme).toBeUndefined();
  expect(audience(updated).audienceTheme).toEqual(audienceThemes.birthday);
  expect(audience(updated)).not.toHaveProperty("fastQuestions");
});

it("validates preset names and limits event copy", () => {
  expect(
    commandSchema.safeParse({
      type: "audienceTheme",
      theme: { ...audienceThemes.birthday, preset: "arbitrary-css" },
    }).success,
  ).toBe(false);
  expect(
    commandSchema.safeParse({
      type: "audienceTheme",
      theme: { ...audienceThemes.birthday, title: "x".repeat(81) },
    }).success,
  ).toBe(false);
});

it("stores theme updates and supports undo on legacy games", () => {
  const store = new Store(":memory:");
  try {
    store.add(createRehearsal("THEMES", "round"));
    const before = store.host("THEMES");
    store.apply("THEMES", {
      id: randomUUID(),
      revision: before.revision,
      command: { type: "audienceTheme", theme: audienceThemes.birthday },
    });
    const after = store.host("THEMES");
    expect(after.audienceTheme).toEqual(audienceThemes.birthday);
    store.apply("THEMES", {
      id: randomUUID(),
      revision: after.revision,
      command: { type: "undo" },
    });
    expect(store.host("THEMES").audienceTheme).toBeUndefined();
  } finally {
    store.close();
  }
});
