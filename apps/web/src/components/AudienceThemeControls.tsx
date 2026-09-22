import { useState } from "react";
import { audienceThemes, type AudienceTheme, type Command, type HostState } from "@naija/contracts";
import { audience } from "@naija/game";
import { Board } from "./Board";

export function AudienceThemeControls({
  state,
  busy,
  send,
}: {
  state: HostState;
  busy: boolean;
  send: (command: Command) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<AudienceTheme | null>(null);
  const [saved, setSaved] = useState(false);
  const theme = draft ?? state.audienceTheme ?? audienceThemes.classic;
  const edit = (value: AudienceTheme) => {
    setDraft(value);
    setSaved(false);
  };
  return (
    <details className="theme-controls settings-card">
      <summary>Audience theme & event text</summary>
      <p>Preview your changes, then publish to all audience screens and connected TVs.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (await send({ type: "audienceTheme", theme })) {
            setDraft(null);
            setSaved(true);
          }
        }}
      >
        <label>
          Design
          <select
            value={theme.preset}
            onChange={(event) =>
              edit({ ...audienceThemes[event.target.value as AudienceTheme["preset"]] })
            }
          >
            <option value="classic">Classic Friends Showdown</option>
            <option value="birthday">Ihechi’s birthday · plum & gold</option>
            <option value="midnight">Midnight · teal & navy</option>
          </select>
        </label>
        <label>
          Event title
          <input
            maxLength={80}
            value={theme.title}
            placeholder="Friends Showdown"
            onChange={(event) => edit({ ...theme, title: event.target.value })}
          />
        </label>
        <label>
          Event subtitle
          <input
            maxLength={160}
            value={theme.subtitle}
            onChange={(event) => edit({ ...theme, subtitle: event.target.value })}
          />
        </label>
        <p>
          Leave the title empty to show the Friends Showdown logo. Selecting a preset resets the
          text to its defaults.
        </p>
        <div className="theme-preview" aria-label="Theme preview">
          <Board compact state={{ ...audience(state), audienceTheme: theme }} />
        </div>
        <button className="button primary" disabled={busy} type="submit">
          Publish to audience
        </button>
        <button
          className="button"
          disabled={busy}
          type="button"
          onClick={() => {
            setDraft(null);
            setSaved(false);
          }}
        >
          Discard changes
        </button>
        {saved && <p role="status">Audience theme published.</p>}
      </form>
    </details>
  );
}
