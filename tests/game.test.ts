import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { starterBank, fastQuestions } from "@naija/content";
import { setupSchema, bankSchema, type GameState, type Command } from "@naija/contracts";
import { createGame, transition, audience } from "@naija/game";
import { Store } from "../apps/server/src/store";
import { fromCsv, toCsv } from "../apps/web/src/lib/csv";
const setup = () =>
  setupSchema.parse({
    teams: [
      { name: "Jollof", members: ["Ada", "Tobi"], captain: 0 },
      { name: "Suya", members: ["Zee", "Femi", "Obi"], captain: 1 },
    ],
    questionIds: starterBank.questions.map((q) => q.id),
  });
const fresh = () =>
  createGame("ABCDEF", setup(), starterBank.questions, fastQuestions, starterBank.notice);
const run = (s: GameState, ...commands: Command[]) =>
  commands.reduce((state, c) => transition(state, c, 1000), s);
const playing = () =>
  run(
    fresh(),
    { type: "buzz", team: 0 },
    { type: "answer", answerId: "a1" },
    { type: "choice", pass: false },
  );
describe("main game", () => {
  it("requires a buzzer before a face-off answer", () =>
    expect(() => transition(fresh(), { type: "answer", answerId: "a1" })).toThrow("buzzed"));
  it("gives the top answer immediate control and rotates to next player", () => {
    const s = playing();
    expect(s.phase).toBe("play");
    expect(s.control).toBe(0);
    expect(s.turns[0]).toBe(1);
    expect(s.bank).toBe(32);
  });
  it("lets the second contestant beat a lower answer", () => {
    const s = run(
      fresh(),
      { type: "buzz", team: 0 },
      { type: "answer", answerId: "a3" },
      { type: "answer", answerId: "a2" },
    );
    expect(s.control).toBe(1);
    expect(s.phase).toBe("choice");
    expect(s.bank).toBe(43);
  });
  it("keeps a tie with the first contestant without scoring twice", () => {
    const s = run(
      fresh(),
      { type: "buzz", team: 1 },
      { type: "answer", answerId: "a2" },
      { type: "answer", answerId: "a2" },
    );
    expect(s.control).toBe(1);
    expect(s.bank).toBe(25);
  });
  it("resets a failed face-off without adding strikes", () => {
    const s = run(fresh(), { type: "buzz", team: 0 }, { type: "miss" }, { type: "miss" });
    expect(s.face.first).toBeNull();
    expect(s.strikes).toBe(0);
    expect(s.turns).toEqual([1, 1]);
  });
  it("passes to the other team", () => {
    const s = run(
      fresh(),
      { type: "buzz", team: 0 },
      { type: "answer", answerId: "a1" },
      { type: "choice", pass: true },
    );
    expect(s.control).toBe(1);
    expect(s.turns[1]).toBe(0);
  });
  it("uses cumulative strikes even when a correct answer intervenes", () => {
    const s = run(
      playing(),
      { type: "miss" },
      { type: "answer", answerId: "a2" },
      { type: "miss" },
      { type: "miss" },
    );
    expect(s.phase).toBe("steal");
    expect(s.bank).toBe(57);
  });
  it("successful steal excludes steal-answer points by default", () => {
    const s = run(
      playing(),
      { type: "miss" },
      { type: "miss" },
      { type: "miss" },
      { type: "answer", answerId: "a2" },
    );
    expect(s.scores).toEqual([0, 32]);
    expect(s.phase).toBe("settled");
    expect(s.revealed).toContain("a2");
    expect(() => transition(s, { type: "answer", answerId: "a3" })).toThrow();
  });
  it("optional steal values and failed steals settle correctly", () => {
    const first = playing();
    first.rules.includeStealAnswer = true;
    expect(
      run(
        first,
        { type: "miss" },
        { type: "miss" },
        { type: "miss" },
        { type: "answer", answerId: "a2" },
      ).scores,
    ).toEqual([0, 57]);
    expect(
      run(playing(), { type: "miss" }, { type: "miss" }, { type: "miss" }, { type: "miss" }).scores,
    ).toEqual([32, 0]);
  });
  it("board completion and show-all cannot add extra points", () => {
    const s = run(
      playing(),
      ...["a2", "a3", "a4", "a5", "a6"].map(
        (answerId) => ({ type: "answer", answerId }) as Command,
      ),
    );
    expect(s.scores).toEqual([100, 0]);
    expect(transition(s, { type: "showAll" }).scores).toEqual([100, 0]);
  });
  it("rejects a duplicate normal answer", () =>
    expect(() => transition(playing(), { type: "answer", answerId: "a1" })).toThrow("already"));
  it("rotates uneven rosters", () => {
    const s = run(
      playing(),
      { type: "answer", answerId: "a2" },
      { type: "answer", answerId: "a3" },
    );
    expect(s.turns[0]).toBe(1);
  });
  it("applies double points and advances to champion only after settlement", () => {
    const s = fresh();
    s.round = 2;
    s.scores = [150, 0];
    const end = run(
      s,
      { type: "buzz", team: 0 },
      { type: "answer", answerId: "a1" },
      { type: "choice", pass: false },
      ...["a2", "a3", "a4", "a5", "a6"].map(
        (answerId) => ({ type: "answer", answerId }) as Command,
      ),
    );
    expect(end.bank).toBe(200);
    expect(end.winner).toBe(0);
    expect(transition(end, { type: "next" }).phase).toBe("champion");
  });
  it("sudden death accepts only the top answer at triple points", () => {
    const s = fresh();
    s.round = 4;
    s.scores = [250, 220];
    const end = run(
      s,
      { type: "buzz", team: 0 },
      { type: "answer", answerId: "a2" },
      { type: "answer", answerId: "a1" },
    );
    expect(end.roundWinner).toBe(1);
    expect(end.scores[1]).toBe(316);
    expect(end.winner).toBe(1);
  });
  it("pause blocks ordinary commands", () =>
    expect(() => transition(transition(playing(), { type: "pause" }), { type: "miss" })).toThrow(
      "Resume",
    ));
  it("does not put hidden answer text, aliases, notes or future questions in audience payload", () => {
    const s = playing(),
      out = audience(s),
      text = JSON.stringify(out);
    expect(out.question.answers[0].text).toBe("Jollof rice");
    expect(out.question.answers[1].text).toBeNull();
    expect(out.question.answers[1].points).toBeNull();
    expect(text).not.toContain("Fried rice");
    expect(text).not.toContain("hostNotes");
    expect(text).not.toContain("acceptedAlternatives");
    expect(text).not.toContain("Roasted plantain");
    expect("questions" in out).toBe(false);
  });
});
describe("Fast Money", () => {
  const fast = () => {
    const s = fresh();
    s.phase = "champion";
    s.winner = 0;
    return transition(s, { type: "fastStart", players: [0, 1] }, 1000);
  };
  it("requires different players", () => {
    const s = fresh();
    s.phase = "champion";
    s.winner = 0;
    expect(() => transition(s, { type: "fastStart", players: [0, 0] })).toThrow("different");
  });
  it("times first turn and rejects late submissions", () => {
    const s = transition(fast(), { type: "fastClock" }, 1000);
    expect(s.fast!.deadline).toBe(21000);
    expect(audience(s).fast!.prompts).toEqual([
      "Question 1",
      "Question 2",
      "Question 3",
      "Question 4",
      "Question 5",
    ]);
    expect(() =>
      transition(s, { type: "fastAnswer", question: 0, text: "Banana", answerId: "a1" }, 21000),
    ).toThrow("Time is up");
  });
  it("pause and resume preserve remaining time", () => {
    let s = transition(fast(), { type: "fastClock" }, 1000);
    s = transition(s, { type: "pause" }, 6000);
    expect(s.fast!.remaining).toBe(15000);
    s = transition(s, { type: "pause" }, 12000);
    expect(s.fast!.deadline).toBe(27000);
  });
  it("hides first-player answers during player two and rejects duplicate meanings", () => {
    let s = run(
      fast(),
      { type: "fastClock" },
      { type: "fastAnswer", question: 0, text: "Bananas", answerId: "a1" },
      { type: "fastEndTurn" },
      ...Array(5).fill({ type: "fastReveal" }),
      { type: "fastNextPlayer" },
      { type: "fastClock" },
    );
    expect(s.fast!.remaining).toBe(25000);
    expect(
      audience(s)
        .fast!.entries.flat()
        .every((e) => e === null),
    ).toBe(true);
    expect(() =>
      transition(s, { type: "fastAnswer", question: 0, text: "Banana", answerId: "a1" }, 1001),
    ).toThrow("Duplicate");
    s = transition(s, { type: "fastAnswer", question: 0, text: "Orange", answerId: "a2" }, 1001);
    expect(s.fast!.entries[1][0]!.points).toBe(25);
  });
  it("can complete both turns and reach 200", () => {
    let s = fast();
    for (let p = 0; p < 2; p++) {
      s = transition(s, { type: "fastClock" }, 1000);
      for (let q = 0; q < 5; q++)
        s = transition(
          s,
          {
            type: "fastAnswer",
            question: q,
            text: fastQuestions[q].answers[p].text,
            answerId: "a" + (p + 1),
          },
          1001,
        );
      s = transition(s, { type: "fastEndTurn" }, 2000);
      for (let i = 0; i < 5; i++) s = transition(s, { type: "fastReveal" }, 2000);
      if (p === 0) s = transition(s, { type: "fastNextPlayer" }, 2000);
    }
    expect(s.fast!.stage).toBe("done");
    expect(
      audience(s)
        .fast!.entries.flat()
        .reduce((sum, e) => sum + (e?.points ?? 0), 0),
    ).toBe(300);
    expect(transition(s, { type: "finish" }).phase).toBe("finished");
  });
});
describe("persistence and content", () => {
  it("deduplicates commands, rejects stale revisions and undoes an award", () => {
    const db = new Store(":memory:");
    db.add(playing());
    let state = db.host("ABCDEF");
    for (const answerId of ["a2", "a3", "a4", "a5", "a6"]) {
      const envelope = {
        id: randomUUID(),
        revision: state.revision,
        command: { type: "answer" as const, answerId },
      };
      state = db.apply("ABCDEF", envelope);
      expect(db.apply("ABCDEF", envelope).revision).toBe(state.revision);
    }
    expect(state.scores[0]).toBe(100);
    expect(() =>
      db.apply("ABCDEF", { id: randomUUID(), revision: 0, command: { type: "undo" } }),
    ).toThrow("changed");
    state = db.apply("ABCDEF", {
      id: randomUUID(),
      revision: state.revision,
      command: { type: "undo" },
    });
    expect(state.scores[0]).toBe(0);
    expect(state.phase).toBe("play");
    db.close();
  });
  it("validates the starter bank and round-trips CSV with quotes", () => {
    const bank = structuredClone(starterBank);
    bank.questions[0].prompt = 'Name a food with a comma, or a "quote".';
    expect(bankSchema.parse(bank).questions.length).toBe(24);
    expect(fromCsv(toCsv(bank)).questions).toEqual(bank.questions);
  });
  it("rejects duplicate question IDs and unclosed CSV quotes", () => {
    const bank = structuredClone(starterBank);
    bank.questions[1].id = bank.questions[0].id;
    expect(() => bankSchema.parse(bank)).toThrow();
    expect(() => fromCsv('"unfinished')).toThrow("unclosed");
  });
});
