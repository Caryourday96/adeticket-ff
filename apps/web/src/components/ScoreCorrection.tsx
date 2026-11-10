import { useState } from "react";
import type { Command, HostState, Side } from "@naija/contracts";

export function ScoreCorrection({
  state,
  busy,
  send,
}: {
  state: HostState;
  busy: boolean;
  send(command: Command): Promise<boolean>;
}) {
  const [team, setTeam] = useState<Side>(0);
  const [direction, setDirection] = useState(1);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  if (state.fast || !["settled", "champion"].includes(state.phase)) return null;
  const delta = direction * Number(amount);
  const total = state.scores[team] + delta;
  const valid =
    Number.isInteger(delta) &&
    delta !== 0 &&
    Math.abs(delta) <= 1000 &&
    total >= 0 &&
    total <= 100000 &&
    reason.trim().length >= 3;
  return (
    <details className="control-card">
      <summary>Correct a team score</summary>
      <p className="host-note">
        For a host correction between rounds. Round awards stay unchanged; the reason is saved
        privately with the scorecard. Undo can reverse the correction. The winning team is
        recalculated before Fast Money.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            !valid ||
            busy ||
            !window.confirm(
              `Change ${state.teams[team].name} from ${state.scores[team]} to ${total} points? This is separate from round awards.`,
            )
          )
            return;
          if (await send({ type: "adjustScore", team, delta, reason: reason.trim() })) {
            setAmount("");
            setReason("");
          }
        }}
      >
        <label>
          Team to correct
          <select value={team} onChange={(e) => setTeam(Number(e.target.value) as Side)}>
            {state.teams.map((t, i) => (
              <option key={i} value={i}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Correction direction
          <select value={direction} onChange={(e) => setDirection(Number(e.target.value))}>
            <option value={1}>Add points</option>
            <option value={-1}>Subtract points</option>
          </select>
        </label>
        <label>
          Points to correct
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Reason for correction
          <input
            maxLength={200}
            minLength={3}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {amount && (
          <p>
            {state.teams[team].name}: {state.scores[team]} → {total} points
          </p>
        )}
        <button className="button" disabled={busy || !valid}>
          Apply score correction
        </button>
      </form>
    </details>
  );
}
