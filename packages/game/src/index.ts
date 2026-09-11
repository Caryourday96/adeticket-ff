import type { Command, GameState, PublicState, Question, Setup, Side } from "@naija/contracts";

const other = (side: Side): Side => (side === 0 ? 1 : 0);
function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export const multiplier = (s: GameState) => s.rules.multipliers[s.round] ?? 3;
export const currentQuestion = (s: GameState) => s.questions[s.round % s.questions.length];
const sudden = (s: GameState) => s.round >= s.rules.multipliers.length;
export function scheduleQuestions(
  questions: Question[],
  groups: NonNullable<Setup["requiredGroups"]> = [],
) {
  requireThat(
    new Set(groups.map((g) => g.category)).size === groups.length,
    "Choose each required group once.",
  );
  requireThat(
    groups.reduce((n, g) => n + g.count, 0) <= 4,
    "Required questions must fit within the four opening rounds.",
  );
  const reserved: Question[] = [];
  for (const group of groups) {
    requireThat(
      Number.isInteger(group.count) && group.count >= 1,
      "Choose a positive whole number for each group.",
    );
    const matches = questions.filter((q) => q.category === group.category);
    requireThat(matches.length >= group.count, `Not enough questions in ${group.category}.`);
    reserved.push(...matches.slice(0, group.count));
  }
  const ids = new Set(reserved.map((q) => q.id));
  return [...reserved, ...questions.filter((q) => !ids.has(q.id))];
}
export function createGame(
  id: string,
  setup: Setup,
  questions: Question[],
  fastQuestions: Question[],
  source: string,
): GameState {
  requireThat(questions.length >= 5, "Select at least five questions.");
  return {
    id,
    revision: 0,
    teams: structuredClone(setup.teams),
    scores: [0, 0],
    rules: setup.rules,
    questions: structuredClone(scheduleQuestions(questions, setup.requiredGroups)),
    source,
    round: 0,
    minimumRounds: Math.max(
      1,
      (setup.requiredGroups ?? []).reduce((n, g) => n + g.count, 0),
    ),
    phase: "faceoff",
    revealed: [],
    bank: 0,
    strikes: 0,
    control: 0,
    turns: [0, 0],
    face: { first: null, current: 0, attempts: [] },
    winner: null,
    roundWinner: null,
    showAll: false,
    paused: false,
    message: "Choose who buzzed first.",
    fast: null,
    fastQuestions: structuredClone(fastQuestions),
  };
}
function award(s: GameState, side: Side) {
  s.scores[side] += s.bank;
  s.roundWinner = side;
  s.phase = "settled";
  s.message = s.teams[side].name + " wins " + s.bank + " points.";
  if (s.round + 1 >= (s.minimumRounds ?? 1) && Math.max(...s.scores) >= s.rules.target) {
    s.winner = s.scores[0] === s.scores[1] ? null : s.scores[0] > s.scores[1] ? 0 : 1;
  } else if (s.scores[side] >= s.rules.target) {
    s.message += " Required question rounds remain before a winner is declared.";
  }
}
function rotate(s: GameState, side: Side) {
  s.turns[side] = (s.turns[side] + 1) % s.teams[side].members.length;
}
function settleFace(s: GameState) {
  const q = currentQuestion(s);
  const [a, b] = s.face.attempts;
  if (a === null && b === null) {
    rotate(s, 0);
    rotate(s, 1);
    s.face = { first: null, current: 0, attempts: [] };
    s.message = "No match. Next contestants: face off again.";
    return;
  }
  const rank = (id: string | null | undefined) =>
    id ? q.answers.findIndex((a) => a.id === id) : Infinity;
  s.control = rank(a) <= rank(b) ? s.face.first! : other(s.face.first!);
  s.phase = "choice";
  s.message = s.teams[s.control].name + " chooses play or pass.";
}
export function transition(input: GameState, cmd: Command, now = Date.now()): GameState {
  const s = structuredClone(input);
  requireThat(cmd.type !== "undo", "Undo is handled by the game store.");
  if (cmd.type === "pause") {
    s.paused = !s.paused;
    if (s.fast?.stage === "running") {
      if (s.paused) {
        s.fast.remaining = Math.max(0, (s.fast.deadline ?? now) - now);
        s.fast.deadline = null;
      } else s.fast.deadline = now + s.fast.remaining;
    }
    s.message = s.paused ? "Game paused." : "Game resumed.";
    return s;
  }
  requireThat(!s.paused, "Resume the game first.");
  const q = currentQuestion(s);
  switch (cmd.type) {
    case "buzz":
      requireThat(
        s.phase === "faceoff" && s.face.first === null,
        "A face-off is already in progress.",
      );
      s.face.first = cmd.team;
      s.face.current = cmd.team;
      s.message = s.teams[cmd.team].members[s.turns[cmd.team]] + " answers first.";
      break;
    case "answer":
    case "miss": {
      requireThat(
        ["faceoff", "play", "steal"].includes(s.phase),
        "Answers cannot be judged in this phase.",
      );
      const answer =
        cmd.type === "answer" ? q.answers.find((a) => a.id === cmd.answerId) : undefined;
      requireThat(cmd.type === "miss" || answer, "Answer is not on this board.");
      if (s.phase === "faceoff") {
        requireThat(s.face.first !== null, "Choose who buzzed first.");
        if (sudden(s)) {
          if (answer?.id === q.answers[0].id) {
            s.revealed = [answer.id];
            s.bank = answer.points * multiplier(s);
            award(s, s.face.current);
          } else {
            s.face.current = other(s.face.current);
            rotate(s, s.face.current);
            s.message = "Not the top answer. Other team answers.";
          }
          break;
        }
        // Repeating the first face-off answer loses the tie without revealing or scoring twice.
        if (answer && !s.revealed.includes(answer.id)) {
          s.revealed.push(answer.id);
          s.bank += answer.points * multiplier(s);
        }
        s.face.attempts.push(answer?.id ?? null);
        if (s.face.attempts.length === 1 && answer?.id === q.answers[0].id) {
          s.control = s.face.current;
          s.phase = "choice";
          s.message = s.teams[s.control].name + " chooses play or pass.";
        } else if (s.face.attempts.length === 1) {
          s.face.current = other(s.face.first);
          s.message = "Other contestant: find a higher answer.";
        } else settleFace(s);
      } else if (s.phase === "steal") {
        requireThat(!answer || !s.revealed.includes(answer.id), "That answer is already revealed.");
        if (answer) {
          s.revealed.push(answer.id);
          if (s.rules.includeStealAnswer) s.bank += answer.points * multiplier(s);
        }
        award(s, answer ? other(s.control) : s.control);
      } else {
        requireThat(!answer || !s.revealed.includes(answer.id), "That answer is already revealed.");
        if (answer) {
          s.revealed.push(answer.id);
          s.bank += answer.points * multiplier(s);
          s.message = "On the board!";
        } else {
          s.strikes++;
          s.message = "Strike " + s.strikes + ".";
        }
        rotate(s, s.control);
        if (s.revealed.length === q.answers.length) award(s, s.control);
        else if (s.strikes === 3) {
          s.phase = "steal";
          s.message = s.teams[other(s.control)].name + " has one chance to steal.";
        }
      }
      break;
    }
    case "choice":
      requireThat(s.phase === "choice", "Play or pass is only available after a face-off.");
      if (cmd.pass) s.control = other(s.control);
      else rotate(s, s.control);
      s.phase = "play";
      s.message = s.teams[s.control].name + " is playing.";
      break;
    case "showAll":
      requireThat(s.phase === "settled", "Finish the round before showing all answers.");
      s.showAll = true;
      break;
    case "next":
      requireThat(s.phase === "settled", "Finish this round first.");
      if (s.winner !== null) {
        s.phase = "champion";
        s.message = s.teams[s.winner].name + " wins the main game!";
        break;
      }
      requireThat(
        s.round + 1 < s.questions.length,
        "No unused questions remain. Import a larger pack for a longer game.",
      );
      s.round++;
      s.revealed = [];
      s.bank = 0;
      s.strikes = 0;
      s.roundWinner = null;
      s.showAll = false;
      s.turns = [s.round % s.teams[0].members.length, s.round % s.teams[1].members.length];
      s.face = { first: null, current: 0, attempts: [] };
      s.phase = "faceoff";
      s.message = sudden(s)
        ? "Sudden death: find the number-one answer."
        : "New round. Choose who buzzed first.";
      break;
    case "turn":
      requireThat(s.phase === "play", "Turn corrections are available during team play.");
      requireThat(cmd.member < s.teams[s.control].members.length, "Unknown member.");
      s.turns[s.control] = cmd.member;
      s.message = "Active player updated.";
      break;
    case "roster":
      requireThat(!["fast", "finished"].includes(s.phase), "Edit rosters before Fast Money.");
      s.teams = structuredClone(cmd.teams);
      s.turns = s.turns.map((n, i) => Math.min(n, s.teams[i].members.length - 1)) as [
        number,
        number,
      ];
      s.message = "Team rosters updated.";
      break;
    case "fastStart": {
      requireThat(s.phase === "champion" && s.winner !== null, "Finish the main game first.");
      requireThat(
        cmd.players[0] !== cmd.players[1] &&
          cmd.players.every((p) => p < s.teams[s.winner!].members.length),
        "Select two different team members.",
      );
      s.fast = {
        players: cmd.players,
        player: 0,
        stage: "ready",
        deadline: null,
        remaining: 20000,
        entries: [Array(5).fill(null), Array(5).fill(null)],
        revealed: [0, 0],
      };
      s.phase = "fast";
      s.message = "Fast Money: keep player two out of hearing.";
      break;
    }
    case "fastClock":
      requireThat(
        s.fast && s.phase === "fast" && s.fast.stage === "ready",
        "The timer is not ready.",
      );
      s.fast.stage = "running";
      s.fast.deadline = now + s.fast.remaining;
      s.message = "Fast Money is live.";
      break;
    case "fastAnswer": {
      const f = s.fast;
      requireThat(f && s.phase === "fast" && f.stage === "running", "Start the timer first.");
      requireThat(now < (f.deadline ?? 0), "Time is up. End the turn.");
      const fq = s.fastQuestions[cmd.question];
      const answer = fq.answers.find((a) => a.id === cmd.answerId);
      requireThat(cmd.answerId === null || answer, "Unknown Fast Money answer.");
      const first = f.entries[0][cmd.question];
      const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (f.player === 1 && first)
        requireThat(
          !(answer && first.answerId === answer.id) && norm(first.text) !== norm(cmd.text),
          "Duplicate answer. Ask for another response.",
        );
      f.entries[f.player][cmd.question] = {
        text: cmd.text,
        answerId: answer?.id ?? null,
        points: answer?.points ?? 0,
      };
      if (cmd.finishIfComplete && f.entries[f.player].every(Boolean)) {
        f.stage = "reveal";
        f.deadline = null;
        f.remaining = 0;
        s.message = "Five answers recorded. Reveal the answers and points.";
      }
      break;
    }
    case "fastEndTurn":
      requireThat(s.fast && s.fast.stage === "running", "No turn is running.");
      s.message =
        s.fast.deadline && now >= s.fast.deadline
          ? "Time's up. Reveal the answers and points."
          : "Reveal the answers and points.";
      s.fast.stage = "reveal";
      s.fast.deadline = null;
      s.fast.remaining = 0;
      break;
    case "fastReveal": {
      const f = s.fast;
      requireThat(f && f.stage === "reveal", "Finish the turn before revealing.");
      f.revealed[f.player] = Math.min(5, f.revealed[f.player] + 1);
      if (f.revealed[f.player] === 5) {
        f.stage = f.player === 0 ? "between" : "done";
        s.message = f.player === 0 ? "Bring in player two." : "Fast Money complete!";
      }
      break;
    }
    case "fastNextPlayer":
      requireThat(
        s.fast && s.fast.stage === "between",
        "Reveal all of player one's answers first.",
      );
      s.fast.player = 1;
      s.fast.stage = "ready";
      s.fast.remaining = 25000;
      s.fast.revealed = [0, 0];
      s.message = "Player two: no duplicate answers.";
      break;
    case "finish":
      requireThat(
        s.phase === "champion" || (s.phase === "fast" && s.fast?.stage === "done"),
        "Complete this game first.",
      );
      s.phase = "finished";
      s.message = "Thanks for playing. Naija, bring the energy!";
      break;
  }
  return s;
}

export function audience(s: GameState): PublicState {
  const { questions, fastQuestions, revealed, fast, ...safe } = s;
  const q = currentQuestion(s);
  const out: PublicState = {
    ...safe,
    multiplier: multiplier(s),
    question: {
      id: q.id,
      prompt: q.prompt,
      category: q.category,
      answers: q.answers.map((a, i) => {
        const visible = s.showAll || revealed.includes(a.id);
        return {
          id: a.id,
          rank: i + 1,
          revealed: visible,
          text: visible ? a.text : null,
          points: visible ? a.points : null,
        };
      }),
    },
    fast: null,
  };
  if (fast) {
    const visible = (player: Side, index: number) =>
      s.phase === "finished" ||
      fast.stage === "done" ||
      (fast.player === 0
        ? player === 0 && index < fast.revealed[0]
        : fast.stage === "reveal" || fast.stage === "between"
          ? player === 0 || index < fast.revealed[1]
          : false);
    out.fast = {
      ...fast,
      entries: fast.entries.map((row, p) =>
        row.map((entry, i) =>
          visible(p as Side, i)
            ? (entry ?? { text: "No answer", answerId: null, points: 0 })
            : null,
        ),
      ) as typeof fast.entries,
      prompts: fastQuestions.map((q, i) =>
        visible(0, i) || visible(1, i) ? q.prompt : "Question " + (i + 1),
      ),
    };
  }
  return out;
}
