import type { HostState } from "@naija/contracts";
import { download } from "../lib/api";
import { scorecard } from "../lib/scorecard";
export function GameResults({ state }: { state: HostState }) {
  return (
    <section className="control-card" aria-label="Game-night results">
      <h2>Game-night results</h2>
      <p>
        {state.winner === null
          ? "No champion declared."
          : `${state.teams[state.winner].name} are your champions!`}
      </p>
      {state.teams.map((team, index) => (
        <p key={index}>
          <strong>{team.name}</strong> · {state.scores[index]} points
        </p>
      ))}
      <h3>Round breakdown</h3>
      {(state.roundResults ?? []).map((round) => (
        <p key={round.round}>
          Round {round.round}: {state.teams[round.winner].name} won {round.points} points.
        </p>
      ))}
      {(state.roundResults ?? []).reduce((sum, round) => sum + round.points, 0) !==
        state.scores[0] + state.scores[1] && (
        <p>
          This breakdown is incomplete for older games. Earlier awards remain included in the team
          totals.
        </p>
      )}
      <button
        className="button"
        onClick={() =>
          download(
            `friends-showdown-${state.id}-scorecard.csv`,
            scorecard(state),
            "text/csv;charset=utf-8",
          )
        }
      >
        Download scorecard
      </button>
    </section>
  );
}
