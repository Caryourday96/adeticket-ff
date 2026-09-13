import type { GameState } from "@naija/contracts";
export function scorecard(state: GameState) {
  const rows: (string | number)[][] = [
    ["Naija Family Showdown", state.id],
    ["Status", state.phase],
    ["Winner", state.winner === null ? "No champion declared" : state.teams[state.winner].name],
    ["Team", "Main game points"],
    ...state.teams.map((team, index) => [team.name, state.scores[index]]),
    [],
    ["Round", "Question", "Winner", "Points awarded"],
    ...(state.roundResults ?? []).map((round) => [
      round.round,
      round.prompt,
      state.teams[round.winner].name,
      round.points,
    ]),
  ];
  if (
    (state.roundResults ?? []).reduce((sum, round) => sum + round.points, 0) !==
    state.scores[0] + state.scores[1]
  )
    rows.push(["Round breakdown unavailable for awards recorded before this feature."]);
  if (state.fast && state.fast.stage === "done") {
    rows.push([], ["Fast Money player", "Question", "Answer", "Points"]);
    state.fast.entries.forEach((row, player) =>
      row.forEach((entry, index) =>
        rows.push([
          state.teams[state.winner!].members[state.fast!.players[player]],
          index + 1,
          entry?.text ?? "No answer",
          entry?.points ?? 0,
        ]),
      ),
    );
  }
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value);
          const safe = /^\s*[=+@-]/.test(text) ? "'" + text : text;
          return '"' + safe.replace(/"/g, '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
