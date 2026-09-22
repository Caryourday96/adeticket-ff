# Verification record

Local verification completed on 11 September 2026.

## Automated checks

- TypeScript strict type check: passed.
- Vitest: 30 tests passed across game and server suites.
- Production frontend and bundled server build: passed.
- Prettier formatting check: passed.
- Frozen-lockfile installation: passed.

Coverage includes face-off ordering and ties, cumulative strikes, both steal outcomes, optional steal points, board completion, duplicate scoring prevention, multipliers, sudden death, pause, private audience projection, Fast Money timing and duplicates, undo, CSV round-trips, HTTP authorization, cross-origin rejection, Socket.IO updates/reconnection, and disk restart recovery.

## Browser checks

- Host sign-in and default team setup.
- Game creation and audience sharing dialog with room-specific QR/link.
- Separate audience screen receiving a reveal and strike.
- Undo restoring the strike count.
- Main-round completion and scoring, rotated contestants, double points, three strikes, failed steal, and main-game winner.
- Fast Money prompts hidden from audience before reveals.
- Player-one answer recording, sequential reveals, and zero-point unanswered rows.
- Player-one answers hidden during player two.
- Duplicate answer rejected with a clear host error; alternative accepted.
- Final bonus total and finished-game screen.
- Music category filtering and question editing saved as a separate pack.
- Audience layout visually checked at 390 × 844.

A completed rehearsal game and an edited question pack remain in local ignored runtime data for inspection.

## Deployment status and limits

Source is pushed to `Caryourday96/adeticket-ff`. GitHub Actions deployment run `34656556703`, attempt 2, succeeded for `08d00a2`. The Windows Web App runs in Canada Central and serves https://ff.adeticket.com with a managed TLS certificate.

The exact Nigerian television design and ruleset have not been verified. The current interface uses an original blue-and-gold TV-style board. The bundled questions use illustrative points. One Fast Money set is included.

Public HTTPS startup and health checks pass. Unauthenticated games and packs APIs correctly return 401. Socket.IO connects successfully using both polling and WebSocket transports with the custom-domain origin. Authenticated cloud rehearsal, saved-game restart recovery, backup/restore, and real phone QR/latency testing remain outstanding.

## Phone buzzer verification

Added HTTP tests for approval, private host access, two competing requests with exactly one accepted winner, repeated/stale packets, wrong roster turn, pause, and removal. Restart recovery also verifies persisted phone approval and locked gates. Browser rehearsal BA97FF verified request → approval → open → first buzz, host synchronization, and refresh recovery. Real hardware/network latency has not yet been measured.

Host layout changes and required question-group quotas are proposals only. Fast Money is unchanged in this update.

## Host layout and required groups — implemented

The host-layout and required-group proposals are now implemented; the previous proposal-only note is superseded. 37 automated tests pass, including category availability/capacity, unique scheduling, early target deferral, ties, and legacy saves. TypeScript and production build pass. Browser rehearsal FD443E created a music-plus-food schedule, verified that five required questions disable creation, and exercised manual buzz, answer selection, undo, pause/resume, and expandable audience preview. Fast Money remains unchanged.

## Latest reliability verification

41 tests pass, including server-only Fast Money expiration, paused turns, late-answer rejection, automatic completion after five answers, duplicate rejection, authenticated phone presence, and presence expiry. TypeScript and production build pass. Browser rehearsal 2B3A44 verified save-and-advance, automatic timeout/reveal recovered after a server restart, player-two duplicate retention followed by a successful alternative, and pause. BA97FF showed one active approved phone after heartbeat recovery. The Fast Money rehearsal is left paused for inspection.

Presence uses a five-second heartbeat and 15-second expiry, with host polling every five seconds. Browser refresh responses are guarded by request sequence. Device-clock differences are adjusted with a periodically sampled server offset; network latency still limits display precision. This supersedes earlier notes describing Fast Money as unchanged.

## Google Cast and advertising setup verification

Gemini branch report, 21 September 2026; review below supersedes activation claims.

- Added `CAST_APP_ID` environment setting documentation to `.env.example`.
- Supported serialized JSON payloads in `castRoom` parser for resilient receiver message handling.
- Hermetic test fixture with isolated `webDir` in `tests/cast.test.ts` ensuring tests pass before and after production build.
- Implemented Google-certified CMP privacy choices reopening button (`googlefc.showRevocationMessage`) in `Advertisement.tsx` and on `/privacy`.
- Updated `/privacy` with operator disclosure (Adeticket Inc., `adeticket@gmail.com`), 7-day session cookies, 30-day survey cookies, and advertising boundary guarantees.
- Verified all Vitest tests (76 passed across 16 test files).
- Verified TypeScript strict typecheck (`tsc --noEmit`) passes with zero errors.
- Verified production build (`node scripts/build.mjs`) compiles frontend and server cleanly.
- Verified Playwright E2E browser tests pass across all suites.

Review: CMP activation is still pending. Reopening now uses Google's callback queue and resolves the method after loading; unavailable messaging is visible. The privacy page links to the rules page without claiming a CMP is already active. The prior synthetic queue-only test was replaced with tests of the actual helper.
