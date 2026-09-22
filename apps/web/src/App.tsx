import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { api } from "./lib/api";
import { Setup } from "./pages/Setup";
import { Host } from "./pages/Host";
import { CastReceiver } from "./pages/CastReceiver";
import { Audience } from "./pages/Audience";
import { Library } from "./pages/Library";
import { Layout } from "./components/Layout";
import { Brand } from "./components/Brand";
import { Player } from "./pages/Player";
import { Surveys, SurveyForm } from "./pages/Surveys";
import { Advertisement } from "./components/Advertisement";
function HostGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{
      authenticated: boolean;
      passwordRequired: boolean;
    } | null>(null),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<typeof session>("/session")
      .then(setSession)
      .catch((e) => setError(e.message));
  }, []);
  if (session?.authenticated) return <>{children}</>;
  return (
    <div className="entry-page">
      <Brand large />
      <section className="entry-card">
        <LockKeyhole size={24} className="gold" />
        <div className="eyebrow">HOST ACCESS</div>
        <h1>
          Your game night
          <br />
          starts here.
        </h1>
        <p>Sign in to set the teams, reveal the answers, and run the show.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/login", { password });
              setSession({
                authenticated: true,
                passwordRequired: session?.passwordRequired ?? false,
              });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {session?.passwordRequired && (
            <label>
              Host passphrase
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          )}
          {session && !session.passwordRequired && (
            <p className="muted">Local preview · no passphrase configured</p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary wide" disabled={!session || busy}>
            {busy ? "Opening…" : "Enter the host desk"}
            <ArrowRight size={16} />
          </button>
        </form>
        <a className="entry-link" href="/play">
          Playing? Join with your game code →
        </a>
        <a className="entry-link" href="/join">
          Here to watch? Join the audience →
        </a>
      </section>
    </div>
  );
}
function Join({ player = false }: { player?: boolean }) {
  const [code, setCode] = useState("");
  return (
    <div className="entry-page">
      <Brand large />
      <section className="entry-card">
        <div className="eyebrow">{player ? "PLAYER JOIN" : "TAKE YOUR SEAT"}</div>
        <h1>
          The family's
          <br />
          waiting for you.
        </h1>
        <p>Enter the room code from your host, or scan their QR code to join directly.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            location.href = (player ? "/play/" : "/audience/") + code.trim().toUpperCase();
          }}
        >
          <label>
            Room code
            <input
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="A1B2C3"
              minLength={6}
              maxLength={6}
              required
            />
          </label>
          <button className="button primary wide">
            {player ? "Join as a player" : "Join audience"}
            <ArrowRight size={17} />
          </button>
        </form>
        <a className="entry-link" href="/">
          I'm hosting instead →
        </a>
      </section>
    </div>
  );
}
function Rules() {
  return (
    <Layout active="rules">
      <main className="page rules-page">
        <div className="eyebrow">A QUICK HOST BRIEFING</div>
        <h1>
          Good answers.
          <br />
          Great game night.
        </h1>
        <p className="lead">The host makes the calls. The scoreboard handles the maths.</p>
        {[
          [
            "01",
            "Face off",
            "Select who buzzed first. Judge their answer, then the other contestant's if needed. The higher answer wins the choice to play or pass. A top answer wins immediately; a tied answer favours the first contestant.",
          ],
          [
            "02",
            "Play the board",
            "Players answer aloud in roster order. Click the matching answer in your private list. Broad answers can be clarified. Three incorrect guesses trigger a steal; face-off misses do not count as team strikes.",
          ],
          [
            "03",
            "One chance to steal",
            "The opposing captain gives one final answer. A correct hidden answer wins the bank plus the stealing answer’s points by default. A miss gives the bank to the original team. Stealing-answer points can be disabled during setup.",
          ],
          [
            "04",
            "Find your champions",
            "The default target is 300 points. Rounds use 1×, 1×, 2×, and 3× values. If needed, sudden death asks for the number-one answer at triple points. Only unused questions are played.",
          ],
          [
            "05",
            "Fast Money",
            "Two distinct winning-team members answer five questions in 20 and 25 seconds. Start after reading the first question. Keep player two out of hearing for the first turn. Duplicate meanings need another answer. Aim for 200 points combined.",
          ],
          [
            "06",
            "You're in control",
            "Undo fixes mistakes. Pause stops the Fast Money clock. Use X for a miss and U for undo when not typing. Share the audience QR code; keep the host dashboard private.",
          ],
        ].map(([n, title, text]) => (
          <section className="rule-card" key={n}>
            <span>{n}</span>
            <div>
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
          </section>
        ))}
        <p className="host-note">
          The supplied questions use illustrative points. This is a configurable TV-style home-game
          preset; the Nigerian show's exact rules and visual details have not been verified.
        </p>
        <Advertisement />
      </main>
    </Layout>
  );
}
export function App() {
  const path = location.pathname.split("/").filter(Boolean);
  if (path[0] === "cast") return <CastReceiver />;
  if (path[0] === "privacy")
    return (
      <Layout>
        <main className="page rules-page">
          <h1>Privacy and advertising</h1>
          <p>
            The game stores team names, player names, game progress and submitted survey answers so
            hosts can run their events. Host and survey cookies support sign-in and prevent
            accidental repeat submissions.
          </p>
          <p>
            When advertising is enabled, the How to play page can display Google ads. Google and its
            partners may use cookies, device information and your IP address to deliver and measure
            ads. Advertising is not loaded on player buzzers, live boards or host controls.
          </p>
          <p>
            Where a consent message is provided, use its privacy settings to manage your choices.
          </p>
          <p>
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
            >
              How Google uses information from partner sites
            </a>
          </p>
          <p>For questions about your event data, contact your event organiser.</p>
        </main>
      </Layout>
    );
  if (path[0] === "survey" && path[1]) return <SurveyForm id={path[1]} />;
  if (path[0] === "audience" && path[1]) return <Audience id={path[1].toUpperCase()} />;
  if (path[0] === "play" && path[1]) return <Player id={path[1].toUpperCase()} />;
  if (path[0] === "play") return <Join player />;
  if (path[0] === "join") return <Join />;
  if (path[0] === "rules") return <Rules />;
  return (
    <HostGate>
      {path[0] === "host" && path[1] ? (
        <Host id={path[1].toUpperCase()} />
      ) : path[0] === "surveys" ? (
        <Surveys />
      ) : path[0] === "library" ? (
        <Library />
      ) : (
        <Setup />
      )}
    </HostGate>
  );
}
