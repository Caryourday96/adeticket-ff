import { z } from "zod";
export * from "./surveys";

const label = z.string().trim().min(1).max(100);
export const answerSchema = z.object({
  id: label,
  text: label,
  points: z.number().int().min(1).max(100),
  acceptedAlternatives: z.array(label).max(30).default([]),
});
export const questionSchema = z
  .object({
    id: label,
    category: label,
    prompt: z.string().trim().min(5).max(300),
    hostNotes: z.string().max(2000).default(""),
    answers: z.array(answerSchema).min(2).max(8),
  })
  .superRefine((q, ctx) => {
    if (new Set(q.answers.map((a) => a.id)).size !== q.answers.length)
      ctx.addIssue({ code: "custom", message: "Answer IDs must be unique." });
    for (let i = 1; i < q.answers.length; i++)
      if (q.answers[i].points > q.answers[i - 1].points)
        ctx.addIssue({ code: "custom", message: "Order answers by descending points." });
  });
export const bankSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: label,
    roundType: z.enum(["regular", "fast-money"]).optional(),
    scoringSource: z.enum(["illustrative", "collected-survey", "episode-derived"]),
    notice: z.string().min(1).max(2000),
    questions: z.array(questionSchema).min(5).max(500),
  })
  .superRefine((b, ctx) => {
    if (new Set(b.questions.map((q) => q.id)).size !== b.questions.length)
      ctx.addIssue({ code: "custom", message: "Question IDs must be unique." });
  });
export type Question = z.infer<typeof questionSchema>;
export type Bank = z.infer<typeof bankSchema>;
export const teamSchema = z
  .object({
    name: label,
    members: z.array(label).min(1).max(12),
    captain: z.number().int().min(0),
    awaitingPlayers: z.boolean().optional(),
  })
  .refine((t) => t.captain < t.members.length, "Captain must be a team member.");
export type Team = z.infer<typeof teamSchema>;
export const rulesSchema = z.object({
  target: z.number().int().min(100).max(1000).default(300),
  multipliers: z.array(z.number().int().min(1).max(5)).length(4).default([1, 1, 2, 3]),
  includeStealAnswer: z.boolean().default(true),
});
export type Rules = z.infer<typeof rulesSchema>;
export const setupSchema = z
  .object({
    teams: z.tuple([teamSchema, teamSchema]),
    questionIds: z.array(label).min(5).max(100),
    rules: rulesSchema.default({}),
    packId: z.string().optional(),
    fastPackId: z.string().optional(),
    fastQuestionIds: z
      .array(label)
      .length(5)
      .refine((ids) => new Set(ids).size === 5, "Choose five distinct Fast Money questions.")
      .optional(),
    requiredGroups: z
      .array(z.object({ category: label, count: z.number().int().min(1).max(4) }))
      .max(4)
      .optional(),
  })
  .refine(
    (s) => new Set(s.questionIds).size === s.questionIds.length,
    "Choose distinct questions.",
  );
export type Setup = z.infer<typeof setupSchema>;
const teamIndex = z.union([z.literal(0), z.literal(1)]);
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("buzz"), team: teamIndex }),
  z.object({ type: z.literal("answer"), answerId: label }),
  z.object({ type: z.literal("miss") }),
  z.object({ type: z.literal("choice"), pass: z.boolean() }),
  z.object({ type: z.literal("next") }),
  z.object({ type: z.literal("showAll") }),
  z.object({ type: z.literal("undo") }),
  z.object({ type: z.literal("endGame") }),
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("turn"), member: z.number().int().min(0).max(11) }),
  z.object({
    type: z.literal("faceoffPlayer"),
    team: teamIndex,
    member: z.number().int().min(0).max(11),
  }),
  z.object({ type: z.literal("roster"), teams: z.tuple([teamSchema, teamSchema]) }),
  z.object({
    type: z.literal("fastStart"),
    players: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  }),
  z.object({ type: z.literal("fastClock") }),
  z.object({ type: z.literal("fastDuration"), seconds: z.number().int().min(10).max(120) }),
  z.object({
    type: z.literal("fastAnswer"),
    question: z.number().int().min(0).max(4),
    text: z.string().trim().min(1).max(100),
    answerId: z.string().nullable(),
    finishIfComplete: z.boolean().optional(),
  }),
  z.object({ type: z.literal("fastEndTurn") }),
  z.object({ type: z.literal("fastReveal") }),
  z.object({ type: z.literal("fastNextPlayer") }),
  z.object({ type: z.literal("finish") }),
]);
export type Command = z.infer<typeof commandSchema>;
export const envelopeSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().min(0),
  command: commandSchema,
});
export type Envelope = z.infer<typeof envelopeSchema>;
export type Side = 0 | 1;
export type Phase =
  "faceoff" | "choice" | "play" | "steal" | "settled" | "champion" | "fast" | "finished";
export type FastEntry = { text: string; answerId: string | null; points: number };
export type FastState = {
  players: [number, number];
  player: Side;
  stage: "ready" | "running" | "reveal" | "between" | "done";
  deadline: number | null;
  remaining: number;
  entries: [(FastEntry | null)[], (FastEntry | null)[]];
  revealed: [number, number];
};
export type GameState = {
  roundResults?: { round: number; prompt: string; winner: Side; points: number }[];
  id: string;
  rehearsal?: boolean;
  revision: number;
  teams: [Team, Team];
  scores: [number, number];
  rules: Rules;
  questions: Question[];
  source: string;
  round: number;
  minimumRounds?: number;
  phase: Phase;
  revealed: string[];
  bank: number;
  strikes: number;
  control: Side;
  turns: [number, number];
  face: { first: Side | null; current: Side; attempts: (string | null)[] };
  winner: Side | null;
  roundWinner: Side | null;
  showAll: boolean;
  paused: boolean;
  message: string;
  fast: FastState | null;
  fastQuestions: Question[];
};
export type PublicAnswer = {
  id: string;
  rank: number;
  revealed: boolean;
  text: string | null;
  points: number | null;
};
export type PublicState = Omit<GameState, "questions" | "fastQuestions" | "revealed" | "fast"> & {
  question: { id: string; prompt: string; category: string; answers: PublicAnswer[] };
  fast:
    | null
    | (Omit<FastState, "entries"> & {
        entries: [(FastEntry | null)[], (FastEntry | null)[]];
        prompts: string[];
      });
  multiplier: number;
};
export type HostState = GameState & { canUndo: boolean; history: string[] };
export type BuzzerPlayer = {
  id: string;
  team: Side;
  member: number;
  name: string;
  approved: boolean;
  onStage?: boolean;
};
export type BuzzerState = {
  epoch: string;
  armed: boolean;
  winner: { team: Side; name: string } | null;
};
export type HostBuzzers = BuzzerState & {
  players: (BuzzerPlayer & { connection: "ready" | "away" | "offline" })[];
};
export type PlayerView = { player: BuzzerPlayer | null; buzzer: BuzzerState };
