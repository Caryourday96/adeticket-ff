import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  BuzzerPlayer,
  GameState,
  RemoteAnswer,
  RemoteAnswerView,
  Side,
} from "@naija/contracts";
import type { Store } from "./store";

const submissionSchema = z
  .object({
    id: z.string().uuid(),
    revision: z.number().int().min(0),
    text: z.string().trim().min(1).max(200),
  })
  .strict();

/** Cosmetic changes and pause/resume are not another opportunity to guess. */
function answerTurn(state: GameState) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        turnRevision: state.answerTurnRevision,
        round: state.round,
        phase: state.phase,
        question: state.questions[state.round % state.questions.length]?.id,
        face: state.face,
        turns: state.turns,
        control: state.control,
        revealed: state.revealed,
        strikes: state.strikes,
        lobby: !!state.lobby,
      }),
    )
    .digest("hex");
}

/** These are player guesses, never matches from the private answer bank. */
export function answerEligibility(s: GameState, player: BuzzerPlayer | null): string | null {
  if (!player?.approved) return "Wait for host approval before sending an answer.";
  if (s.teams[player.team].members[player.member] !== player.name)
    return "Your roster place changed. Ask the host to check your registration.";
  if (s.lobby) return "Your team is in the lobby. Wait for the host to start.";
  if (s.paused) return "The game is paused.";
  let side: Side;
  let member: number;
  if (s.phase === "faceoff") {
    if (s.face.first === null) return "Buzz in first, then wait for your answer turn.";
    side = s.face.current;
    member = s.turns[side];
    if (player.onStage === false) return "Wait for the host to put you on stage.";
  } else if (s.phase === "play") {
    side = s.control;
    member = s.turns[side];
  } else if (s.phase === "steal") {
    side = s.control === 0 ? 1 : 0;
    member = s.teams[side].captain;
  } else return "Typed answers open during your regular-round answer turn.";
  if (player.team !== side || player.member !== member)
    return "It is another player's answer turn.";
  return null;
}

/** Persistent, idempotent submissions. Judging and scoring stay with the existing host engine. */
export class RemotePlay {
  constructor(
    private db: DatabaseSync,
    private store: Store,
  ) {
    db.exec(`CREATE TABLE IF NOT EXISTS remote_answers (
      id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      revision INTEGER NOT NULL,
      turn_key TEXT,
      player TEXT NOT NULL,
      body TEXT NOT NULL,
      UNIQUE(game,revision,player)
    ); CREATE INDEX IF NOT EXISTS remote_answers_game ON remote_answers(game,revision);`);
    // Compatible with databases made by an interrupted pre-release implementation.
    const columns = db.prepare("PRAGMA table_info(remote_answers)").all() as { name: string }[];
    if (!columns.some((column) => column.name === "turn_key"))
      db.exec("ALTER TABLE remote_answers ADD COLUMN turn_key TEXT");
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS remote_answers_turn ON remote_answers(game,turn_key,player) WHERE turn_key IS NOT NULL",
    );
  }
  playerView(gameId: string, token: string | undefined): RemoteAnswerView {
    const state = this.store.host(gameId);
    const player = this.store.player(gameId, token);
    const reason = answerEligibility(state, player);
    const row = player
      ? (this.db
          .prepare("SELECT body FROM remote_answers WHERE game=? AND turn_key=? AND player=?")
          .get(gameId, answerTurn(state), player.id) as { body: string } | undefined)
      : undefined;
    return {
      revision: state.revision,
      eligible: reason === null,
      reason: reason ?? "Your answer goes privately to the host for judging.",
      submission: row ? JSON.parse(row.body) : null,
    };
  }
  hostView(gameId: string) {
    const state = this.store.host(gameId);
    const rows = this.db
      .prepare("SELECT body FROM remote_answers WHERE game=? AND turn_key=? ORDER BY rowid")
      .all(gameId, answerTurn(state)) as { body: string }[];
    return {
      revision: state.revision,
      answers: rows.map((row) => JSON.parse(row.body) as RemoteAnswer),
    };
  }
  submit(gameId: string, token: string | undefined, input: unknown): RemoteAnswer {
    const body = submissionSchema.parse(input);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const player = this.store.player(gameId, token);
      if (!player?.approved) throw new Error("Host approval required.");
      const state = this.store.host(gameId);
      const old = this.db.prepare("SELECT body FROM remote_answers WHERE id=?").get(body.id) as
        { body: string } | undefined;
      if (old) {
        const previous = JSON.parse(old.body) as RemoteAnswer;
        if (
          previous.gameId !== gameId ||
          previous.playerId !== player.id ||
          previous.revision !== body.revision ||
          previous.text !== body.text
        )
          throw new Error("This request ID was already used. Refresh before trying again.");
        // A retry of an accepted request remains a receipt, even after the host moves on.
        this.db.exec("COMMIT");
        return previous;
      }
      if (state.revision !== body.revision)
        throw new Error("The game changed. Review the current turn before sending your answer.");
      const reason = answerEligibility(state, player);
      if (reason) throw new Error(reason);
      const turn = answerTurn(state);
      if (
        this.db
          .prepare("SELECT 1 FROM remote_answers WHERE game=? AND turn_key=? AND player=?")
          .get(gameId, turn, player.id)
      )
        throw new Error("Your answer is already sent. Wait for the host to judge it.");
      const answer: RemoteAnswer = {
        id: body.id,
        gameId,
        revision: state.revision,
        playerId: player.id,
        name: player.name,
        team: player.team,
        text: body.text,
        createdAt: Date.now(),
      };
      this.db
        .prepare(
          "INSERT INTO remote_answers(id,game,revision,turn_key,player,body) VALUES(?,?,?,?,?,?)",
        )
        .run(answer.id, gameId, answer.revision, turn, player.id, JSON.stringify(answer));
      this.db.exec("COMMIT");
      return answer;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  forget(gameId: string) {
    this.db.prepare("DELETE FROM remote_answers WHERE game=?").run(gameId);
  }
}
