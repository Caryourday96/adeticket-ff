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
function Catalogue() {
  return (
    <div className="catalogue-page">
      <header className="catalogue-header">
        <a className="catalogue-brand" href="/catalogue">
          adeticket<span>play</span>
        </a>
        <a href="mailto:adeticket@gmail.com">Get in touch ↗</a>
      </header>
      <main>
        <section className="catalogue-intro">
          <div className="eyebrow">GOOD COMPANY. GREAT COMPETITION.</div>
          <h1>
            Bring everyone
            <br />
            into the game.
          </h1>
          <p>Pick your game, gather your people, and make a night of it.</p>
          <a className="button primary" href="#games">
            Explore games ↓
          </a>
        </section>
        <section id="games" className="catalogue-games">
          <div className="catalogue-section-heading">
            <h2>Your next game night</h2>
            <span>01 / AVAILABLE NOW</span>
          </div>
          <article className="catalogue-card">
            <div className="catalogue-art" aria-hidden="true">
              <span>FAMILY</span>
              <strong>SHOWDOWN</strong>
              <div>
                <i>1</i>
                <i>2</i>
                <i>3</i>
                <i>4</i>
              </div>
            </div>
            <div className="catalogue-details">
              <div className="eyebrow">TEAMS · TRIVIA · PHONE BUZZERS</div>
              <div className="catalogue-title-row">
                <h3>Family Showdown</h3>
                <span className="alpha-badge">ALPHA</span>
              </div>
              <p>
                Two teams. One survey board. Guess the popular answers, race to buzz in, and go for
                the steal.
              </p>
              <div className="catalogue-actions">
                <a className="button primary" href="https://ff.kayodeadetunji.com/">
                  Open game ↗
                </a>
                <a href="https://ff.kayodeadetunji.com/play">Join with a game code →</a>
              </div>
              <a href="https://ff.kayodeadetunji.com/rules">Read the rules</a>
            </div>
          </article>
        </section>
      </main>
      <footer className="catalogue-footer">
        <span>Adeticket Inc.</span>
        <a href="mailto:adeticket@gmail.com">adeticket@gmail.com</a>
      </footer>
    </div>
  );
}
export function App() {
  const path = location.pathname.split("/").filter(Boolean);
  if (path[0] === "catalogue" || location.hostname === "play.adeticket.com") return <Catalogue />;
  if (path[0] === "cast") return <CastReceiver />;
  if (path[0] === "privacy")
    return (
      <Layout>
        <main className="page rules-page">
          <h1>Privacy and advertising</h1>
          <p className="lead">
            Family Showdown is operated by Adeticket Inc. (
            <a href="mailto:adeticket@gmail.com">adeticket@gmail.com</a>).
          </p>

          <section className="rule-card">
            <span>01</span>
            <div>
              <h2>Data and event storage</h2>
              <p>
                The service stores game progress, team rosters, contestant names, and submitted
                survey responses so hosts can run events. Game data is stored in persistent
                application storage and can be deleted by the host through the dashboard cleanup
                controls.
              </p>
            </div>
          </section>

          <section className="rule-card">
            <span>02</span>
            <div>
              <h2>Cookies and sessions</h2>
              <p>
                We use strictly necessary first-party cookies: host authentication cookies (7-day
                expiry), player room session cookies (7-day expiry) to allow reconnects on mobile
                buzzers, and survey cookies (30-day expiry) to prevent accidental duplicate voting.
                No third-party marketing cookies are used during gameplay.
              </p>
            </div>
          </section>

          <section className="rule-card">
            <span>03</span>
            <div>
              <h2>Advertising boundaries</h2>
              <p>
                When advertising is activated by the operator, Google AdSense responsive display ads
                are loaded solely below the instructions on the public How to play (
                <a href="/rules">/rules</a>) page. Advertising scripts, third-party cookies, and ad
                network trackers are never loaded on player buzzers, join forms, audience boards,
                survey forms, or host desks.
              </p>
              <p>
                Google and its advertising partners may use cookies, device identifiers, and IP
                addresses to deliver and measure ads. Read{" "}
                <a
                  href="https://policies.google.com/technologies/partner-sites"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  how Google uses information from partner sites
                </a>
                .
              </p>
            </div>
          </section>

          <section className="rule-card">
            <span>04</span>
            <div>
              <h2>Privacy and cookie choices</h2>
              <p>
                Before advertising is enabled, the operator must configure and test consent
                messaging for applicable regions. When available, use the privacy settings beside
                the ad on the How to play page. If no advertising or consent message is loaded,
                those controls may be unavailable.
              </p>
              <p>
                <a className="button small" href="/rules#privacy-choices">
                  Manage privacy &amp; cookie choices
                </a>
              </p>
            </div>
          </section>

          <section className="rule-card">
            <span>05</span>
            <div>
              <h2>Contact and data requests</h2>
              <p>
                For questions regarding event data, privacy practices, or to request removal of
                stored data, contact Adeticket Inc. at{" "}
                <a href="mailto:adeticket@gmail.com">adeticket@gmail.com</a>.
              </p>
            </div>
          </section>
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
