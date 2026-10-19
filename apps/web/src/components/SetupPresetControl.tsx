import { useState } from "react";
import { z } from "zod";
import { teamSchema } from "@naija/contracts";
const schema = z.object({
  name: z.string().trim().min(1).max(60),
  teams: z.tuple([teamSchema, teamSchema]),
  selfJoin: z.boolean(),
  packId: z.string(),
  fastPackId: z.string(),
  sharedQuestionBank: z.boolean(),
  excludeAfterUses: z.number().int().min(1).max(100).optional(),
  shuffle: z.boolean(),
  steal: z.boolean(),
  target: z.number().int().min(100).max(1000),
});
export type SetupPreset = z.infer<typeof schema>;
const key = "ff-setup-preset-v1";
export function SetupPresetControl({
  value,
  load,
  busy,
}: {
  value: Omit<SetupPreset, "name">;
  load: (p: SetupPreset) => boolean;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  function action(kind: "save" | "load" | "clear") {
    try {
      if (kind === "save") {
        const parsed = schema.safeParse({ ...value, name });
        if (!parsed.success) {
          setMessage("Enter a preset name and complete valid teams and settings before saving.");
          return;
        }
        if (
          localStorage.getItem(key) &&
          !window.confirm("Replace the saved setup preset on this device?")
        )
          return;
        localStorage.setItem(key, JSON.stringify(parsed.data));
        setMessage(`Saved ${parsed.data.name} on this device.`);
      } else if (kind === "clear") {
        localStorage.removeItem(key);
        setMessage("Saved setup cleared. Current settings are unchanged.");
      } else {
        const raw = localStorage.getItem(key);
        if (!raw) {
          setMessage("No setup preset saved on this device yet.");
          return;
        }
        const parsed = schema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          setMessage("Saved setup is unreadable. Clear it and save a new preset.");
          return;
        }
        if (!load(parsed.data)) {
          setMessage("Preset not loaded. Review the error above and choose another setup.");
          return;
        }
        setName(parsed.data.name);
        setMessage(
          "Preset loaded. Review current question availability and selections before creating the game.",
        );
      }
    } catch {
      setMessage("Could not access the saved preset. You can still set up a game normally.");
    }
  }
  return (
    <details className="control-card">
      <summary>Saved setup preset</summary>
      <p>
        Optional: save one named setup on this device. Includes team names and roster; no answers,
        scores or phone registrations. Question selections are rebuilt when loaded.
      </p>
      <label>
        Preset name
        <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="button-row">
        {(
          [
            ["save", "Save setup"],
            ["load", "Load saved setup"],
            ["clear", "Clear saved setup"],
          ] as const
        ).map(([kind, label]) => (
          <button className="button" key={kind} disabled={busy} onClick={() => action(kind)}>
            {label}
          </button>
        ))}
      </div>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
