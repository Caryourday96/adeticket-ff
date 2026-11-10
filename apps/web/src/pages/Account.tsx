import { createContext, useContext, useEffect, useState, Fragment, type ReactNode } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { api, clearPrivateCaches } from "../lib/api";
import { Brand } from "../components/Brand";
import { AlphaNotice } from "../components/AlphaNotice";

export type PlatformGroup = {
  id: string;
  name: string;
  suspended: boolean;
  role: "owner" | "admin" | "host";
};
export type AccountSession = {
  authenticated: boolean;
  passwordRequired: boolean;
  multiTenant?: boolean;
  user?: { id: string; email: string; superAdmin: boolean } | null;
  groups?: PlatformGroup[];
};
const SessionContext = createContext<AccountSession | null>(null);
export const useAccount = () => useContext(SessionContext);

export function AccountGate({
  children,
}: {
  children: ReactNode | ((session: AccountSession) => ReactNode);
}) {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      api<AccountSession>("/session")
        .then((value) => {
          if (!active) return;
          if (!value.authenticated) clearPrivateCaches();
          setSession(value);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    const expired = () => {
      clearPrivateCaches();
      setSession((current) =>
        current ? { ...current, authenticated: false, user: null, groups: [] } : current,
      );
      setError("Your access has ended. Sign in again or contact your group administrator.");
    };
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    window.addEventListener("ff-session-expired", expired);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("ff-session-expired", expired);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("group");
    if (
      session?.authenticated &&
      requested &&
      (session.user?.superAdmin || session.groups?.some((group) => group.id === requested))
    ) {
      try {
        sessionStorage.setItem("ff-group", requested);
      } catch {}
    }
  }, [session]);
  if (session?.authenticated)
    return (
      <SessionContext.Provider value={session}>
        <Fragment key={JSON.stringify([session.user?.id, session.groups])}>
          {typeof children === "function" ? children(session) : children}
        </Fragment>
      </SessionContext.Provider>
    );
  return (
    <main className="entry-page">
      <Brand large />
      <AlphaNotice />
      <section className="entry-card">
        <LockKeyhole size={24} className="gold" />
        <div className="eyebrow">
          {session?.multiTenant ? "YOUR GROUPS. YOUR GAME NIGHT." : "HOST ACCESS"}
        </div>
        <h1>
          Your game night
          <br />
          starts here.
        </h1>
        <p>
          {session?.multiTenant
            ? "Sign in to manage your groups or host your assigned games."
            : "Sign in to set the teams, reveal the answers, and run the show."}
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              clearPrivateCaches();
              await api("/login", { password, ...(session?.multiTenant ? { email } : {}) });
              setPassword("");
              setSession(await api<AccountSession>("/session"));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {session?.multiTenant && (
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
              />
            </label>
          )}
          {(session?.passwordRequired || session?.multiTenant) && (
            <label>
              {session?.multiTenant ? "Password" : "Host passphrase"}
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={session?.multiTenant ? 128 : 1024}
              />
            </label>
          )}
          {session && !session.passwordRequired && !session.multiTenant && (
            <p className="muted">Local preview · no passphrase configured</p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary wide" disabled={!session || busy}>
            {busy ? "Signing in…" : session?.multiTenant ? "Sign in" : "Enter the host desk"}
            <ArrowRight size={16} />
          </button>
        </form>
        {!session && error && (
          <button className="button wide" onClick={() => location.reload()}>
            Retry connection
          </button>
        )}
        {session?.multiTenant && (
          <p className="account-help">
            New here? Open the invitation from your group administrator. For a forgotten password,
            contact the platform owner for account recovery. There is no public registration.
          </p>
        )}
        <a className="entry-link" href="/play">
          Playing? Join with your game code
        </a>
        <a className="entry-link" href="/join">
          Here to watch? Join the audience
        </a>
      </section>
    </main>
  );
}

type InvitationInfo = {
  email: string;
  groupName: string;
  role: "admin" | "host";
  expiresAt: number;
  existingAccount: boolean;
};
export function InvitationAcceptance() {
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get("token") ?? "");
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token) {
      setError("This invitation link is incomplete. Ask your administrator for a new link.");
      return;
    }
    api<InvitationInfo>("/platform/invitation-info", { token })
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, [token]);
  return (
    <main className="entry-page">
      <Brand large />
      <section className="entry-card">
        <div className="eyebrow">YOU’RE INVITED</div>
        <h1>Join the host team.</h1>
        {!info && !error && <p role="status">Checking your invitation…</p>}
        {info && (
          <>
            <p>
              Join <strong>{info.groupName}</strong> as{" "}
              {info.role === "admin" ? "a group administrator" : "a game host"}.
            </p>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setError("");
                try {
                  clearPrivateCaches();
                  await api("/platform/invitations/accept", { token, email: info.email, password });
                  history.replaceState(null, "", "/dashboard");
                  location.assign("/dashboard");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Invited email
                <input type="email" autoComplete="username" value={info.email} readOnly />
              </label>
              <label>
                {info.existingAccount ? "Your existing password" : "Create a password"}
                <input
                  type="password"
                  autoComplete={info.existingAccount ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
              <p className="muted">
                {info.existingAccount
                  ? "Use your existing account password. Accepting adds this group to your account."
                  : "Use at least 12 characters. Keep this password separate from your other accounts."}
              </p>
              <button className="button primary wide" disabled={busy}>
                {busy ? "Joining…" : "Accept invitation"}
                <ArrowRight size={16} />
              </button>
            </form>
            <p className="account-help">
              Expires {new Date(info.expiresAt).toLocaleString()}. Forgotten an existing password?
              Contact the platform owner for recovery.
            </p>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <a className="entry-link" href="/">
          Back to sign in
        </a>
      </section>
    </main>
  );
}
