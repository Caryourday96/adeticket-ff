import { randomBytes } from "node:crypto";
import { setupSchema } from "@naija/contracts";
import { createGame } from "@naija/game";
import { PlatformError, type Principal } from "./platform";
import type { Store } from "./store";

/** Replay only the assigned source's saved configuration, never a caller-provided bank or roster.
 * The HTTP caller must authenticate before invoking this helper. Current group permissions are
 * checked again here and by the transaction that carries the caller's explicit host assignment.
 */
export function replayFinishedGame(store: Store, sourceId: string, principal: Principal | null) {
  const multiTenant = store.platform.enabled();
  if (!principal || (!multiTenant && (principal.id !== "legacy-host" || !principal.superAdmin)))
    throw new PlatformError("Sign in to host this game.", 401);
  if (multiTenant && !store.platform.canReadResource(principal, "game", sourceId))
    throw new PlatformError("You do not have access to replay this game.");

  const previous = store.saved(sourceId).state;
  if (previous.phase !== "finished" || previous.rehearsal)
    throw new PlatformError("Finish the previous real game before starting a replay.", 409);
  const groupId = store.platform.resourceGroup("game", sourceId);
  if (multiTenant) store.platform.assertActiveGroup(groupId);

  const existing = store.nextGame(sourceId);
  if (existing) {
    if (
      store.platform.resourceGroup("game", existing) !== groupId ||
      (multiTenant && !store.platform.canReadResource(principal, "game", existing))
    )
      throw new PlatformError(
        "A next game exists, but you do not have access to it. Ask the group administrator.",
      );
    return { id: existing, groupId, created: false };
  }

  let id = randomBytes(3).toString("hex").toUpperCase();
  while (store.has(id)) id = randomBytes(3).toString("hex").toUpperCase();
  const setup = setupSchema.parse({
    teams: previous.teams,
    rules: previous.rules,
    questionIds: previous.questions.map((question) => question.id),
  });
  const created = createGame(
    id,
    setup,
    previous.questions,
    previous.fastQuestions,
    previous.source,
  );
  created.lobby = true;
  created.minimumRounds = previous.minimumRounds ?? 1;
  if (previous.audienceTheme) created.audienceTheme = structuredClone(previous.audienceTheme);
  if (previous.audienceSoundEnabled !== undefined)
    created.audienceSoundEnabled = previous.audienceSoundEnabled;
  created.message = "Replay lobby ready. Keep your teams, check the phones, then start the game.";

  // One transaction creates the fresh snapshot, ownership, approved phones, successor link and
  // narrowly scoped successor host grant. Failure leaves the original and its mapping unchanged.
  store.addWithPlayers(created, sourceId, groupId, multiTenant ? principal : undefined);
  return { id, groupId, created: true };
}
