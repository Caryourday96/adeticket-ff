import { setupSchema, type Question } from "@naija/contracts";
import { starterBank, fastQuestions, validateFastSet } from "@naija/content";
import { createGame, transition } from "@naija/game";

export function createRehearsal(id: string, scenario: "round" | "fast", selected?: Question[]) {
  const practiceQuestions = selected ?? fastQuestions;
  validateFastSet(practiceQuestions);
  const setup = setupSchema.parse({
    teams: [
      { name: "Practice Jollof", members: ["Ada", "Chidi", "Tobi"], captain: 0 },
      { name: "Practice Suya", members: ["Zainab", "Emeka", "Femi"], captain: 0 },
    ],
    questionIds: starterBank.questions.map((q) => q.id),
  });
  let state = createGame(id, setup, starterBank.questions, practiceQuestions, starterBank.notice);
  state.rehearsal = true;
  state.message = "Rehearsal: read the question, open buzzers, then simulate a contestant.";
  if (scenario === "fast") {
    state.phase = "champion";
    state.winner = 0;
    state.scores = [300, 150];
    state = transition(state, { type: "fastStart", players: [0, 1] });
  }
  return state;
}
