import { z } from "zod";
export const surveyCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    roundType: z.enum(["regular", "fast-money"]),
    questions: z
      .array(z.object({ prompt: z.string().trim().min(5).max(300) }))
      .min(5)
      .max(30),
  })
  .refine(
    (s) => new Set(s.questions.map((q) => q.prompt.toLowerCase())).size === s.questions.length,
    "Remove repeated questions.",
  );
export type SurveyQuestion = { id: string; prompt: string };
export type Survey = {
  id: string;
  title: string;
  roundType: "regular" | "fast-money";
  questions: SurveyQuestion[];
  open: boolean;
  createdAt: string;
  revision: number;
  grouping: Record<string, Record<string, string>>;
  reviewed: string[];
};
export type SurveyResults = Survey & {
  responseCount: number;
  results: {
    id: string;
    prompt: string;
    answered: number;
    variants: { key: string; text: string; count: number }[];
    groups: { text: string; count: number; points: number; alternatives: string[] }[];
  }[];
};
export type PublicSurvey = Pick<Survey, "id" | "title" | "roundType" | "questions" | "open"> & {
  submitted: boolean;
};
