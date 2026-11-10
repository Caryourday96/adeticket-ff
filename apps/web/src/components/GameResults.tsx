import type { HostState } from "@naija/contracts";
import { download, groupHref } from "../lib/api";
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
      {state.phase === "finished" && !state.rehearsal && (
        <a
          className="button primary"
          href={groupHref(`/?setup=yes&reuse=${encodeURIComponent(state.id)}`, state.groupId)}
        >
          Play again with these teams
        </a>
      )}
      <h3>Round breakdown</h3>
      {(state.roundResults ?? []).map((round) => (
        <p key={round.round}>
          Round {round.round}: {state.teams[round.winner].name} won {round.points} points.{" "}
          {round.outcome === "steal"
            ? "Successful steal"
            : round.outcome === "failed-steal"
              ? "Steal defended"
              : round.outcome === "clear"
                ? "Board cleared"
                : round.outcome === "sudden-death"
                  ? "Sudden death"
                  : "Outcome unavailable for this older round"}
          {round.settledAt != null && (
            <>
              {" "}
              ·{" "}
              <time dateTime={new Date(round.settledAt).toISOString()}>
                {new Date(round.settledAt).toLocaleString()}
              </time>
            </>
          )}
        </p>
      ))}
      {(state.roundResults ?? []).reduce((sum, round) => sum + round.points, 0) !==
        state.scores[0] +
          state.scores[1] -
          (state.scoreAdjustments ?? []).reduce((sum, a) => sum + a.delta, 0) && (
        <p>
          This breakdown is incomplete for older games. Earlier awards remain included in the team
          totals.
        </p>
      )}
      {!!state.scoreAdjustments?.length && (
        <div>
          <h3>Host score corrections</h3>
          {state.scoreAdjustments.map((a, i) => (
            <p key={i}>
              {state.teams[a.team].name}: {a.delta > 0 ? "+" : ""}
              {a.delta} · {a.reason}
            </p>
          ))}
        </div>
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
