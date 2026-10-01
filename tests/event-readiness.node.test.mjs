import { test } from "node:test";
import assert from "node:assert/strict";
import { eventReadiness } from "../apps/web/src/lib/eventReadiness.ts";

const ready = {
  audienceConnections: 1,
  boardConfirmed: true,
  soundEnabled: true,
  soundConfirmed: true,
  silentEvent: false,
  spokenAnswers: false,
  buzzerConnected: true,
  stagedTeams: 2,
};
test("connections alone never confirm picture or audible sound", () => {
  assert.deepEqual(eventReadiness({ ...ready, boardConfirmed: false, soundConfirmed: false }), {
    display: false,
    audio: false,
    contestants: true,
  });
});
test("unknown display status, muted sound and lost phone stream invalidate readiness", () => {
  assert.deepEqual(
    eventReadiness({
      ...ready,
      audienceConnections: null,
      soundEnabled: false,
      buzzerConnected: false,
    }),
    { display: false, audio: false, contestants: false },
  );
});
test("one staged team is insufficient; explicit silent and spoken modes remain available", () => {
  assert.equal(eventReadiness({ ...ready, stagedTeams: 1 }).contestants, false);
  assert.deepEqual(
    eventReadiness({
      ...ready,
      stagedTeams: 0,
      buzzerConnected: false,
      soundEnabled: false,
      silentEvent: true,
      spokenAnswers: true,
    }),
    { display: true, audio: true, contestants: true },
  );
});
