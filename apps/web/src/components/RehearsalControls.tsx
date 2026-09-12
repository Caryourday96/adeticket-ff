import { useEffect, useState } from "react";
import type { HostState, BuzzerState, Side } from "@naija/contracts";
import { currentQuestion } from "@naija/game";
import { api } from "../lib/api";

export function RehearsalControls({ state: s, busy }: { state: HostState; busy: boolean }) {
  const [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [suggestion, setSuggestion] = useState("");
  useEffect(() => {
    setSuggestion("");
  }, [s.revision]);
  async function simulate(team: Side) {
    setWorking(true);
    setError("");
    try {
      const gate = await api<BuzzerState>(`/games/${s.id}/buzzers`);
      if (!gate.armed)
        throw new Error("Open buzzers in the phone controls first, then simulate a buzz.");
      await api(`/games/${s.id}/rehearsal/buzz`, { team, epoch: gate.epoch });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function start(scenario: "round" | "fast") {
    setWorking(true);
    setError("");
    try {
      const next = await api<{ id: string }>("/rehearsals", { scenario });
      location.href = "/host/" + next.id;
    } catch (e) {
      setError((e as Error).message);
      setWorking(false);
    }
  }
  const guides: Record<string, string> = {
    faceoff:
      s.face.first === null
        ? "Read the question. Open buzzers below, then choose a simulated contestant."
        : "Ask for an answer. Use a suggestion below and judge it with your normal answer controls.",
    choice: "Choose Play or Pass in the normal controls to decide which team plays.",
    play: "Practice revealing answers, marking misses and Undo. Three misses open a steal; clearing the board wins the round.",
    steal:
      "The opposing captain gets one answer. Judge a correct hidden answer for a successful steal, or mark a miss to return the bank to the playing team.",
    settled:
      "Check the awarded score, reveal remaining answers, then advance to the next round. Try Undo to correct an award.",
    champion: "Choose two players in the normal controls to Practice Fast Money.",
    fast: "Use the Fast Money controls below. Start the timer after reading question one; Practice passing, returning, recording answers and revealing points. Player two must give different answers.",
    finished:
      "Practice complete. Start another rehearsal or return to the host desk to create a real game.",
  };
  return (
    <section className="rehearsal-panel" aria-label="Rehearsal coach">
      <div className="eyebrow">REHEARSAL · SIMULATED CONTESTANTS</div>
      <h2>Practice running the show.</h2>
      <p>
        {s.paused
          ? "The game is paused. Resume with the normal host controls when ready."
          : guides[s.phase]}
      </p>
      <div className="button-row">
        {s.phase === "faceoff" &&
          s.face.first === null &&
          s.teams.map((team, i) => (
            <button
              key={i}
              className="button"
              disabled={busy || working || s.paused}
              onClick={() => void simulate(i as Side)}
            >
              Simulate {team.members[s.turns[i]]} buzzing
            </button>
          ))}
        {["faceoff", "play", "steal"].includes(s.phase) && (
          <>
            <button
              className="button"
              disabled={s.paused}
              onClick={() =>
                setSuggestion(
                  currentQuestion(s).answers.find((a) => !s.revealed.includes(a.id))?.text ??
                    "All answers are already revealed.",
                )
              }
            >
              Suggest a board answer
            </button>
            <button
              className="button"
              disabled={s.paused}
              onClick={() => setSuggestion("The simulated contestant has no answer. Mark a miss.")}
            >
              Simulate no answer
            </button>
          </>
        )}
      </div>
      {suggestion && (
        <p className="host-note" role="status">
          Practice response: {suggestion}
        </p>
      )}
      <div className="button-row">
        <button
          className="button small"
          disabled={working || busy}
          onClick={() => void start("round")}
        >
          New round rehearsal
        </button>
        <button
          className="button small"
          disabled={working || busy}
          onClick={() => void start("fast")}
        >
          New Fast Money rehearsal
        </button>
        <a className="button small" href="/">
          Back to host desk
        </a>
      </div>
      <p className="muted">
        Shortcuts create a separate saved Practice game. Use the host desk to end or delete old
        rehearsals. Simulated buzzes do not test real phone latency.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
