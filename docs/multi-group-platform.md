# Multi-group platform implementation

Reviewed 2026-11-09. Branch: `feature/multi-group-platform`, starting at `ec1ab77`.

## 10 November — implemented and locally verified

Individual accounts, group permissions, owner/admin dashboards, manual email-bound invitations,
lobbies, private typed player answers, roster/phone recovery, score corrections and assigned-host
replay are implemented. Replay preserves the old game and uses the exact saved questions/rules;
it grants only the initiating host access to the successor game. Removed successor grants are not
restored by retries. Administrators retain the existing configurable Play again flow.

Latest verification:147 Vitest tests,7 Node checks,typecheck,build and3 platform browser scenarios
pass. The mobile scenario covers roster reorder/Undo, correction, replay and continued phone
registration. All37 legacy browser scenarios also pass. Targeted dependency
patches and Zod v4 migration clear the fresh vulnerability audit. Production remains unchanged.
Automatic invitation delivery needs a sender; private link/copy/email-app delivery is available.

## Verified starting point

React/Vite frontend, Express 5 HTTP API, Socket.IO 4 live rooms, Node SQLite on persistent `DATA_DIR`. The pure `packages/game` transition engine already handles scores, strikes, reveals, steals, Fast Money, pause, revision conflicts and command deduplication. Registered phones use hashed cookie credentials; public projections omit unrevealed answers. Multiple game IDs already operate independently. All administrators currently share `HOST_PASSWORD` and unrestricted host sessions. Private host snapshots are currently cached in browser local storage, which is unsuitable for separate accounts.

Existing JSON game snapshots retain questions, answers, teams, rounds, scores and bounded command/history records. Preserve those records; add normalized identity, group, membership, invitation, game-host assignment, resource ownership and audit tables. Legacy games, packs and surveys belong to an initial owner-controlled group. Built-in banks remain shared read-only content; new global library edits require owner access. No destructive migration or new paid service.

## Architecture decision

Keep the existing framework and one server process. Add server-only database access policies, validated group scopes and current permission checks on each protected request and socket join/broadcast. SQLite does not implement PostgreSQL row-level security: isolation must be enforced and tested in this backend. Never expose a database credential or query API to clients. A game PIN grants public/player entry only.

Supabase was assessed: its PostgreSQL RLS and Auth are useful for a future distributed service, but replacing the established persistence/auth/socket engine introduces a separate migration and service dependency. Socket.IO horizontal scaling also requires shared coordination/adapters; it is not achieved by adding tenant tables. This release supports simultaneous groups on a single process, not horizontal autoscale. Sources reviewed 2026-11-09: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Socket.IO adapters](https://socket.io/docs/v4/adapter).

## Incremental implementation plan

1. `platform.ts`, `platformRoutes.ts`, `admin-cli.ts`: explicit owner bootstrap, salted scrypt passwords, hashed expiring sessions/invitations, group admin/assigned-host roles, suspension/revocation and audit. Disable legacy shared-passphrase access after bootstrap. No web Super Admin registration.
2. `store.ts`, `app.ts`, `index.ts`: attach additive schema, preserve snapshots, scope collections, validate referenced banks/reused games, guard all private/public suspended-group flows and live socket streams. Existing public projections remain authoritative.
3. `Platform.tsx`, `Account.tsx`, `App.tsx`, `Layout.tsx`, API helper: owner/group dashboards, account login/invitation acceptance, explicit group navigation, host assignment and logout. Remove private disk caches and clear host UI when access is revoked.
4. Existing game contracts/engine/Host/Player plus remote-play helper: explicit new-game lobby for multi-group games and permitted remote answer submissions for host judgment. Preserve existing single-group behavior and scoring rules.
5. Integration/security/browser tests: two groups and admins, cross-group negative cases, invitation expiry/reuse/revoke, active socket revocation, independent rooms, one winning buzz, hidden-answer projection, restart recovery and phone-size navigation.
6. Document provisioning, recovery, migration/rollback, email-delivery configuration, limits and verification evidence. Update canonical backlog and both checkpoints. No production authentication cutover until owner credentials are provisioned securely and the rollout is reviewable.

## External dependencies / decisions

Email delivery requires a configured sender/provider; invitation links can be issued securely without claiming an email was delivered. Never place real invitation tokens, credentials or user email addresses in docs/logs. Production provisioning must receive secrets through the operator's private environment, not chat. The pasted request ends at acceptance item 11 (`Group and`); the preceding requirements are the implemented scope.

## Status

Implementation complete for the scoped multi-group release; final local regression results are recorded in CODEX_PROGRESS.md. Production activation and an automatic email sender remain pending. No production changes performed.

## Operator bootstrap, recovery and activation

The release is prepared on `feature/multi-group-platform`; see CODEX_PROGRESS.md for the latest
push and verification status. It has not been merged or deployed. Roster recovery, score corrections
and assigned-host replay are implemented. Activate only after agreeing the cutover and privately
provisioning owner credentials; a branch push does not change production authentication.

Build with Node 24 and the pinned pnpm version. `pnpm build` produces `dist/admin.cjs` beside the
server bundle. The CLI supports `bootstrap` (first owner only) and `recover` (existing account).
Both require temporary `FF_ADMIN_EMAIL` and `FF_ADMIN_PASSWORD` environment variables. Set
`DATA_DIR` explicitly to the intended persistent database directory before either operation.
`NODE_ENV=production` requires it; a mistaken directory would operate on a different database.

Use a trusted operator terminal and a password manager. Do not send credentials through chat,
put them in command arguments, commit them, or leave them in permanent Azure app settings.
PowerShell can prompt without putting a literal password in shell history:

```powershell
$env:FF_ADMIN_EMAIL = Read-Host 'Administrator email'
$privatePassword = Read-Host 'Password (12-128 characters)' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($privatePassword)
try {
  $env:FF_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  node dist/admin.cjs bootstrap
  if ($LASTEXITCODE -ne 0) { throw 'Account operation did not succeed.' }
} finally {
  Remove-Item Env:FF_ADMIN_PASSWORD, Env:FF_ADMIN_EMAIL -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  $privatePassword.Dispose()
}
```

This example assumes the intended `DATA_DIR` is already set in the terminal environment. At the
deployed release root, use `node admin.cjs bootstrap` without `dist/`. For recovery, substitute
`recover`, using the existing account email. Recovery resets that account's password, removes its
suspension and revokes previous sessions. The service does not have a public password-reset form.
The temporary environment is visible to the local/hosting operator; this is not end-to-end encryption.

Bootstrap refuses a second owner and invalidates old shared host sessions. After bootstrap,
`HOST_PASSWORD` no longer signs anyone in. Before bootstrap, existing passphrase mode continues;
deploying the bundle alone does not create accounts or activate multi-group access. Existing games,
packs and surveys are assigned to **Original Friends Showdown** (`legacy`); do not invite admins to
that group unless they should access those records. Built-in banks remain shared.

Plan activation outside an event: confirm a single app process and the existing persistent
`DATA_DIR`; stop all app processes; take a private copy of the database and any journal files;
retain the matching previous release artifact. Confirm the backup is recoverable before any
production cutover. Deploy only with authorization, stop processes for bootstrap against the
confirmed production path, remove temporary credential variables, then restart. Verify owner
login, preserved legacy content, old-passphrase denial, separate groups, invitation acceptance,
assigned-host access, player joins, hidden answers, reveal, revoke and reconnect. Only then remove
the obsolete `HOST_PASSWORD` application setting. No new DNS or paid service is required.

**Rollback after activation is not an old-binary-only redeploy.** An older single-group binary
does not enforce tenant permissions against the new database. Prefer a forward fix or keep the
service offline. Restoring the pre-activation database plus its matching old binary must occur
while stopped, preserve a separate private copy of the new database, and have explicit approval
because it discards changes since the backup. Never delete identity/ownership tables to bypass login.
Restarting this shared server also interrupts Bible Blitz's in-memory rooms.

Invitations are bound to an email, expire after 48 hours and can be revoked. Creating another
pending invite for the same group/email replaces the old one. Use Copy link or Open email app
for private delivery; **no mail is automatically sent**. Tokens are stored hashed and carried in
the link fragment. Existing-account acceptance requires that account's password. Possession of a
privately delivered link is not an independent mailbox-verification service. Automatic email
delivery still needs an approved sender configuration.
