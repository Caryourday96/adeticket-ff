import { bankSchema, type Question } from "@naija/contracts";
import raw from "../data/starter-questions.json";
import fastRaw from "../data/fast-money.json";
export const starterBank = bankSchema.parse(raw);
export const fastBank = bankSchema.parse({ ...fastRaw, roundType: "fast-money" });
export const fastQuestions = fastBank.questions;
export function validateFastSet(questions: Question[]) {
  if (questions.length !== 5) throw new Error("Fast Money requires five questions.");
  const attainable = questions.reduce(
    (sum, q) => sum + q.answers[0].points + q.answers[1].points,
    0,
  );
  if (attainable < 200) throw new Error("Fast Money set cannot reach 200 using distinct answers.");
}
validateFastSet(fastQuestions);
