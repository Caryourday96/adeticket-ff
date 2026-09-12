# Security and quality review — 12 September 2026

GitHub initially reported 12 CodeQL alerts: 11 missing rate-limiting alerts in the
Express application and one insufficient password-hashing-work alert. The application
now limits API requests with express-rate-limit, with a stricter login budget, and
verifies the host passphrase using asynchronous scrypt with a random salt. SHA-256
remains appropriate for high-entropy random session and player tokens; it is no
longer used to verify human passwords. The Azure host password does not need changing
to use this verification implementation.

API traffic has a 6,000-request/minute shared-IP limit and login has 10 attempts/minute.
These budgets are process-local, matching the one-instance deployment. Forwarding
headers supplied by callers are not trusted. Behind Azure/IIS, a proxy address may
be shared across users: verify its networking before configuring trusted proxies or
tightening the general budget. Socket.IO transport traffic is separate from the
Express API limiter; transport-level flood protection is not claimed by this change.

Dependabot vulnerability and malware alerts were enabled. Secret scanning and push
protection were already enabled; secret scanning showed zero open alerts. The new
dependency scan identified Vitest's redirect-mock advisory (GHSA-82fw-gwwq-j7x9) in
the manifest and lockfile. Vitest was upgraded to 4.1.11; `pnpm audit` then reported
zero known vulnerabilities. Both validation and Azure deployment now run the audit
and fail for moderate or higher findings, alongside formatting, types, tests and build.

Rehearsal simulations require host authentication and a persisted rehearsal marker.
They use normal buzzer checks and cannot inject a simulated buzz into a real game.
End-game commands use revision checks and undo history. Deletion checks the current
revision, removes the selected game and its registrations in a transaction, clears
buzzer memory, and notifies connected clients. Tests cover those boundaries, login
throttling and forged forwarding headers.

Google Cast was removed at the user's request, including its external SDK scripts,
public configuration route and extra Content Security Policy allowances.

After publishing, verify the new GitHub CodeQL/Dependabot results rather than treating
a successful build as evidence that alerts have closed. No existing alerts were
manually dismissed. This review is not a penetration test or a guarantee against
undiscovered vulnerabilities. Branch protection and required CodeQL checks were not
changed; the deployment workflow runs its own validation and dependency audit.
