import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Copy, Plus, ShieldCheck, Users } from "lucide-react";
import { Layout } from "../components/Layout";
import { api, groupHref, selectedGroup } from "../lib/api";
import { useAccount, type PlatformGroup } from "./Account";

type Member = { userId: string; email: string; role: "admin" | "host"; suspended: boolean };
type Invitation = {
  id: string;
  email: string;
  role: "admin" | "host";
  groupId: string;
  expiresAt: number;
  revoked: boolean;
  used: boolean;
};
type Audit = {
  id: string;
  at: number;
  actorId: string;
  action: string;
  groupId: string | null;
  targetId: string | null;
};
type Detail = {
  group: PlatformGroup;
  members: Member[];
  invitations: Invitation[];
  resources: { games: string[]; packs: string[]; surveys: string[] };
  hosts: { gameId: string; userId: string; email: string }[];
  audit: Audit[];
};
type User = { id: string; email: string; superAdmin: boolean; suspended: boolean };
type Overview = {
  user: User;
  groups: PlatformGroup[];
  stats?: { groups: number; users: number; games: number; activeGroups: number };
};
type Game = {
  id: string;
  teams: string[];
  phase: string;
  round: number;
  scores?: number[];
  winner?: number | null;
  rehearsal?: boolean;
  lobby?: boolean;
};

const roleName = (role: string) =>
  role === "owner" ? "Super admin" : role === "admin" ? "Group admin" : "Game host";
const dateTime = (at: number) => new Date(at).toLocaleString();

export function Platform() {
  const session = useAccount();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [newName, setNewName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "host">("admin");
  const [invite, setInvite] = useState<(Invitation & { token: string }) | null>(null);
  const [hostGame, setHostGame] = useState("");
  const [hostUser, setHostUser] = useState("");
  const [existingUser, setExistingUser] = useState("");
  const [existingRole, setExistingRole] = useState<"admin" | "host">("admin");
  const groupId = selectedGroup();
  const owner = !!session?.user?.superAdmin;
  const group = detail?.group;
  const manage = detail && detail.group.role !== "host";

  async function refresh() {
    const me = await api<Overview>("/platform/me");
    setOverview(me);
    if (groupId && groupId !== "global") {
      const [group, roomList] = await Promise.all([
        api<Detail>(`/platform/groups/${encodeURIComponent(groupId)}`),
        api<Game[]>("/games"),
      ]);
      setDetail(group);
      setNewName(group.group.name);
      setGames(roomList);
    } else {
      setDetail(null);
      setGames([]);
    }
    if (me.user.superAdmin) {
      const [accounts, events] = await Promise.all([
        api<User[]>("/platform/users"),
        api<Audit[]>("/platform/audit"),
      ]);
      setUsers(accounts);
      setAudit(events);
    }
  }
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    // The group data loads after navigation, so the fragment target is not present on arrival.
    if (group?.role !== "host" || location.hash !== "#group-games") return;
    const heading = document.getElementById("group-games");
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start" });
  }, [group?.id, group?.role]);
  async function change(action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await refresh();
      setMessage(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function chooseGroup(id: string) {
    try {
      sessionStorage.setItem("ff-group", id);
    } catch {}
  }
  const inviteUrl = invite
    ? `${location.origin}/invite#token=${encodeURIComponent(invite.token)}`
    : "";
  const canInvite = manage && !group?.suspended;
  const availableHosts = detail?.members.filter((m) => m.role === "host" && !m.suspended) ?? [];
  const adminPrefix = group ? `/platform/groups/${encodeURIComponent(group.id)}` : "";
  function submitGroup(event: FormEvent) {
    event.preventDefault();
    void change(async () => {
      await api("/platform/groups", { name });
      setName("");
    }, "Group created. Open it below to invite its administrators.");
  }
  return (
    <Layout active="platform">
      <main className="page platform-page">
        <header className="platform-heading">
          <div>
            <div className="eyebrow">{owner ? "PLATFORM OWNER" : "YOUR GAME NIGHTS"}</div>
            <h1>{owner ? "Bring your groups together." : "Your groups, ready to play."}</h1>
            <p>
              {owner
                ? "Create spaces for your people. Each group keeps its own games, hosts and question banks."
                : "Open a group to prepare a game, or continue a game you have been assigned to host."}
            </p>
          </div>
          <ShieldCheck className="platform-heading-icon" size={42} aria-hidden="true" />
        </header>
        {error && (
          <p className="error platform-notice" role="alert">
            {error}{" "}
            <button
              className="button small"
              disabled={busy}
              onClick={() => void change(async () => {}, "Updated.")}
            >
              Retry
            </button>
          </p>
        )}
        {message && (
          <p className="platform-notice" role="status">
            {message}
          </p>
        )}
        {loading && <p role="status">Loading your groups…</p>}
        {overview?.stats && (
          <section className="platform-stats" aria-label="Platform statistics">
            <div>
              <strong>{overview.stats.groups}</strong>
              <span>Groups</span>
            </div>
            <div>
              <strong>{overview.stats.activeGroups}</strong>
              <span>Active groups</span>
            </div>
            <div>
              <strong>{overview.stats.users}</strong>
              <span>Admin and host accounts</span>
            </div>
            <div>
              <strong>{overview.stats.games}</strong>
              <span>Saved games</span>
            </div>
          </section>
        )}
        {owner && (
          <section className="platform-panel">
            <h2>Create a group</h2>
            <form className="platform-inline-form" onSubmit={submitGroup}>
              <label>
                Group name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={80}
                  placeholder="For example, Friday game night"
                />
              </label>
              <button className="button primary" disabled={busy}>
                <Plus size={17} />
                Create group
              </button>
            </form>
            <a className="platform-text-link" href="/library?group=global">
              Manage the shared question library <ArrowRight size={15} />
            </a>
          </section>
        )}
        <section aria-labelledby="groups-heading">
          <h2 id="groups-heading">{owner ? "All groups" : "Your groups"}</h2>
          <div className="platform-groups">
            {overview?.groups.map((g) => (
              <article
                className={`platform-group ${g.id === groupId ? "selected" : ""}`}
                key={g.id}
              >
                <div className="platform-card-heading">
                  <Users size={20} />
                  <span className="platform-badge">
                    {g.suspended ? "Suspended" : roleName(g.role)}
                  </span>
                </div>
                <h3>{g.name}</h3>
                <a
                  className="button"
                  href={`${groupHref("/dashboard", g.id)}${g.role === "host" ? "#group-games" : ""}`}
                  onClick={() => chooseGroup(g.id)}
                >
                  Open group <ArrowRight size={16} />
                </a>
              </article>
            ))}
          </div>
          {overview && !overview.groups.length && (
            <p className="platform-notice">
              No groups are assigned to your account yet. Ask an administrator for an invitation.
            </p>
          )}
        </section>
        {detail && group && (
          <section className="platform-group-detail" aria-labelledby="current-group-heading">
            <header className="platform-section-heading">
              <div>
                <div className="eyebrow">CURRENT GROUP · {roleName(group.role).toUpperCase()}</div>
                <h2 id="current-group-heading">{group.name}</h2>
              </div>
              {group.suspended && <span className="platform-badge danger">Suspended</span>}
            </header>
            {group.suspended && (
              <p className="platform-notice">
                This group is suspended. Joining and gameplay are paused until the platform owner
                restores access.
              </p>
            )}
            {manage && !group.suspended && (
              <nav className="platform-actions" aria-label="Group tools">
                <a className="button primary" href={groupHref("/?setup=yes", group.id)}>
                  Create game <Plus size={16} />
                </a>
                <a className="button" href={groupHref("/library", group.id)}>
                  Group questions
                </a>
                <a className="button" href={groupHref("/surveys", group.id)}>
                  Group surveys
                </a>
              </nav>
            )}
            <section className="platform-panel">
              <h3 id="group-games" tabIndex={-1}>
                {manage ? "Games and results" : "Your assigned games"}
              </h3>
              <p className="muted">
                {manage
                  ? "Open the host desk to manage a live room, or review the scores from a previous game."
                  : "Your host access is limited to these games. Ask a group administrator if a game is missing."}
              </p>
              <div className="platform-game-list">
                {games.map((game) => (
                  <article className="platform-game" key={game.id}>
                    <div>
                      <strong>{game.teams.join(" vs ")}</strong>
                      <p className="muted">
                        {game.id} · {game.rehearsal ? "Rehearsal · " : ""}
                        {game.phase === "finished"
                          ? "Finished"
                          : game.lobby
                            ? "Waiting in lobby"
                            : `Round ${game.round} · ${game.phase}`}
                      </p>
                      {game.scores && (
                        <p className="platform-score">
                          {game.teams
                            .map((team, i) => `${team}: ${game.scores?.[i] ?? 0}`)
                            .join(" · ")}
                        </p>
                      )}
                      {game.phase === "finished" && (
                        <p className="muted">
                          {game.winner === 0 || game.winner === 1
                            ? `Winner: ${game.teams[game.winner]}`
                            : "No champion recorded"}
                        </p>
                      )}
                    </div>
                    {!group.suspended && (
                      <a className="button small" href={groupHref(`/host/${game.id}`, group.id)}>
                        {game.phase === "finished" ? "View results" : "Open host desk"}
                      </a>
                    )}
                  </article>
                ))}
              </div>
              {!games.length && (
                <p className="platform-empty">
                  {manage
                    ? "No games yet. Create one to generate a shareable game code."
                    : "No games have been assigned yet."}
                </p>
              )}
            </section>
            {manage && (
              <>
                <section className="platform-panel">
                  <h3>Administrators and hosts</h3>
                  <p className="muted">
                    Administrators manage this group. Hosts control only games assigned to them.
                  </p>
                  <div className="platform-member-list">
                    {detail.members.map((member) => (
                      <div className="platform-member" key={member.userId}>
                        <div>
                          <strong>{member.email}</strong>
                          <p className="muted">
                            {member.suspended ? "Account suspended" : roleName(member.role)}
                          </p>
                        </div>
                        <div className="platform-row-actions">
                          <label>
                            Role for {member.email}
                            <select
                              aria-label={`Role for ${member.email}`}
                              value={member.role}
                              disabled={busy || group.suspended}
                              onChange={(e) =>
                                void change(
                                  () =>
                                    api(`${adminPrefix}/members`, {
                                      userId: member.userId,
                                      role: e.target.value,
                                    }),
                                  "Membership updated.",
                                )
                              }
                            >
                              <option value="admin">Group admin</option>
                              <option value="host">Game host</option>
                            </select>
                          </label>
                          <button
                            className="button small"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove ${member.email} from ${group.name}? Their access to this group will end immediately.`,
                                )
                              )
                                void change(
                                  () =>
                                    api(`${adminPrefix}/members`, {
                                      userId: member.userId,
                                      role: member.role,
                                      remove: true,
                                    }),
                                  "Membership removed.",
                                );
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!detail.members.length && (
                    <p className="platform-empty">Invite your first group administrator below.</p>
                  )}
                  {owner && (
                    <form
                      className="platform-inline-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void change(
                          () =>
                            api(`${adminPrefix}/members`, {
                              userId: existingUser,
                              role: existingRole,
                            }),
                          "Existing account assigned to this group.",
                        );
                      }}
                    >
                      <label>
                        Assign an existing account
                        <select
                          value={existingUser}
                          onChange={(e) => setExistingUser(e.target.value)}
                          required
                        >
                          <option value="">Choose an account</option>
                          {users
                            .filter(
                              (user) =>
                                !user.superAdmin &&
                                !user.suspended &&
                                !detail.members.some((m) => m.userId === user.id),
                            )
                            .map((user) => (
                              <option value={user.id} key={user.id}>
                                {user.email}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Membership role
                        <select
                          value={existingRole}
                          onChange={(e) => setExistingRole(e.target.value as "admin" | "host")}
                        >
                          <option value="admin">Group admin</option>
                          <option value="host">Game host</option>
                        </select>
                      </label>
                      <button
                        className="button"
                        disabled={busy || group.suspended || !existingUser}
                      >
                        Assign account
                      </button>
                    </form>
                  )}
                </section>
                <section className="platform-panel">
                  <h3>Invite someone</h3>
                  <form
                    className="platform-inline-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void change(async () => {
                        const created = await api<Invitation & { token: string }>(
                          `${adminPrefix}/invitations`,
                          { email, role },
                        );
                        setInvite(created);
                        setEmail("");
                      }, "Invitation created. Send the private link to the invited email address.");
                    }}
                  >
                    <label>
                      Email address
                      <input
                        type="email"
                        autoComplete="off"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        maxLength={254}
                        required
                      />
                    </label>
                    <label>
                      Access
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as "admin" | "host")}
                      >
                        <option value="admin">Group admin</option>
                        <option value="host">Game host</option>
                      </select>
                    </label>
                    <button className="button primary" disabled={busy || !canInvite}>
                      Create invitation
                    </button>
                  </form>
                  {invite && (
                    <div className="platform-invite-result">
                      <p>
                        Private invitation for <strong>{invite.email}</strong>. Expires{" "}
                        {dateTime(invite.expiresAt)}.
                      </p>
                      <label>
                        Invitation link
                        <input
                          readOnly
                          value={inviteUrl}
                          onFocus={(event) => event.target.select()}
                        />
                      </label>
                      <div className="platform-actions">
                        <button
                          className="button small"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(inviteUrl);
                              setMessage("Invitation link copied.");
                            } catch {
                              setMessage(
                                "Copy is unavailable. Select and copy the invitation link above.",
                              );
                            }
                          }}
                        >
                          <Copy size={15} />
                          Copy link
                        </button>
                        <a
                          className="button small"
                          href={`mailto:${encodeURIComponent(invite.email)}?subject=${encodeURIComponent(`Join ${group.name} on Friends Showdown`)}&body=${encodeURIComponent(`You are invited to join ${group.name} as ${roleName(invite.role).toLowerCase()}. Open this private link before ${dateTime(invite.expiresAt)}:\n\n${inviteUrl}`)}`}
                        >
                          Open email app
                        </a>
                        <button className="button small" onClick={() => setInvite(null)}>
                          Hide link
                        </button>
                      </div>
                      <p className="muted">
                        Creating a link does not send an email. Share it only with the invited
                        person. The link is shown once here; create a replacement if you lose it.
                      </p>
                    </div>
                  )}
                  <div className="platform-invitation-list">
                    {detail.invitations.map((invitation) => (
                      <div className="platform-member" key={invitation.id}>
                        <div>
                          <strong>{invitation.email}</strong>
                          <p className="muted">
                            {roleName(invitation.role)} ·{" "}
                            {invitation.used
                              ? "Accepted"
                              : invitation.revoked
                                ? "Revoked"
                                : invitation.expiresAt <= Date.now()
                                  ? "Expired"
                                  : `Expires ${dateTime(invitation.expiresAt)}`}
                          </p>
                        </div>
                        {!invitation.used &&
                          !invitation.revoked &&
                          invitation.expiresAt > Date.now() && (
                            <button
                              className="button small"
                              disabled={busy}
                              onClick={() =>
                                void change(async () => {
                                  await api(`/platform/invitations/${invitation.id}/revoke`, {});
                                  if (invite?.id === invitation.id) setInvite(null);
                                }, "Invitation revoked.")
                              }
                            >
                              Revoke
                            </button>
                          )}
                      </div>
                    ))}
                  </div>
                </section>
                <section className="platform-panel">
                  <h3>Assign a game host</h3>
                  <p className="muted">
                    An invitation with the Game host role does not grant control of every game.
                    Assign each room here.
                  </p>
                  <form
                    className="platform-inline-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void change(
                        () => api(`/platform/games/${hostGame}/hosts`, { userId: hostUser }),
                        "Game host assigned.",
                      );
                    }}
                  >
                    <label>
                      Game
                      <select
                        value={hostGame}
                        onChange={(e) => setHostGame(e.target.value)}
                        required
                      >
                        <option value="">Choose a game</option>
                        {games.map((game) => (
                          <option key={game.id} value={game.id}>
                            {game.teams.join(" vs ")} ({game.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Host
                      <select
                        value={hostUser}
                        onChange={(e) => setHostUser(e.target.value)}
                        required
                      >
                        <option value="">Choose a host</option>
                        {availableHosts.map((host) => (
                          <option key={host.userId} value={host.userId}>
                            {host.email}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="button"
                      disabled={busy || group.suspended || !hostGame || !hostUser}
                    >
                      Assign host
                    </button>
                  </form>
                  {!availableHosts.length && (
                    <p className="muted">
                      Invite a game host first. They will appear here after accepting.
                    </p>
                  )}
                  <div>
                    {(detail.hosts ?? []).map((host) => (
                      <div className="platform-member" key={`${host.gameId}:${host.userId}`}>
                        <div>
                          <strong>{host.email}</strong>
                          <p className="muted">Game {host.gameId}</p>
                        </div>
                        <button
                          className="button small"
                          disabled={busy}
                          onClick={() =>
                            void change(
                              () =>
                                api(`/platform/games/${host.gameId}/hosts`, {
                                  userId: host.userId,
                                  remove: true,
                                }),
                              "Host access removed.",
                            )
                          }
                        >
                          Remove assignment
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
                <AuditList events={detail.audit} title="Group activity" />
              </>
            )}
            {owner && (
              <section className="platform-panel">
                <h3>Group settings</h3>
                <form
                  className="platform-inline-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void change(() => api(adminPrefix, { name: newName }), "Group name updated.");
                  }}
                >
                  <label>
                    Group name
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      maxLength={80}
                    />
                  </label>
                  <button className="button" disabled={busy}>
                    Save name
                  </button>
                </form>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        group.suspended
                          ? `Restore access to ${group.name}?`
                          : `Suspend ${group.name}? Its hosts and players will lose access immediately. Saved games will be retained.`,
                      )
                    )
                      void change(
                        () => api(adminPrefix, { suspended: !group.suspended }),
                        group.suspended ? "Group restored." : "Group suspended.",
                      );
                  }}
                >
                  {group.suspended ? "Restore group" : "Suspend group"}
                </button>
              </section>
            )}
          </section>
        )}
        {owner && (
          <>
            <section className="platform-panel">
              <h2>Administrative accounts</h2>
              <p className="muted">
                Suspending an account ends all its administrative sessions. Group memberships and
                game history are retained.
              </p>
              {users.map((user) => (
                <div className="platform-member" key={user.id}>
                  <div>
                    <strong>{user.email}</strong>
                    <p className="muted">
                      {user.superAdmin
                        ? "Super admin"
                        : user.suspended
                          ? "Suspended"
                          : "Active account"}
                    </p>
                  </div>
                  {!user.superAdmin && (
                    <button
                      className="button small"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `${user.suspended ? "Restore" : "Suspend"} access for ${user.email}?`,
                          )
                        )
                          void change(
                            () =>
                              api(`/platform/users/${user.id}/suspension`, {
                                suspended: !user.suspended,
                              }),
                            user.suspended ? "Account restored." : "Account suspended.",
                          );
                      }}
                    >
                      {user.suspended ? "Restore account" : "Suspend account"}
                    </button>
                  )}
                </div>
              ))}
            </section>
            <AuditList events={audit} title="Platform activity" />
          </>
        )}
        <p className="account-help">
          Need to recover an administrator account? Contact the platform owner. Player game codes
          never grant host access.
        </p>
      </main>
    </Layout>
  );
}

function AuditList({ events, title }: { events: Audit[]; title: string }) {
  return (
    <section className="platform-panel">
      <details>
        <summary>{title}</summary>
        {events.length ? (
          <ol className="platform-audit">
            {events.map((event) => (
              <li key={event.id}>
                <strong>{event.action.replace(/[._-]/g, " ")}</strong>
                <span>{dateTime(event.at)}</span>
                <small>{event.targetId ? `Reference: ${event.targetId}` : "Platform"}</small>
              </li>
            ))}
          </ol>
        ) : (
          <p className="platform-empty">No activity recorded yet.</p>
        )}
      </details>
    </section>
  );
}
