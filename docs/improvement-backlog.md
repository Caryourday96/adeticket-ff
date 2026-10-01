# Friends Showdown improvement backlog

This is the current handoff list. “Shipped” means the code is in `main`; live deployment or physical-device verification is called out separately.

## Shipped recently

- Survey creation now has explicit preset/manual sources, duplicate removal, valid question-count checks and Fast Money’s exactly-five-question rule. Commit `d5d19fb`.
- Fast Money expiry audio uses the authoritative server transition and avoids duplicate local/server cues. Commit `9aad7d8`.
- Host reconnect recovery shows the last confirmed revision and offers a server-state refresh.
- Host diagnostics show game revision, host sockets, audience screens, registered players and approved players.
- Hosts can lock new player joins and remove all registered player phones with confirmation.
- Player buzzers show a readiness checklist for connection, approval, stage assignment and open buzzers.
- Azure deployment runs smoke checks for `/api/health`, `/api/config`, `/cast` and `/ads.txt`.
- Brief-disconnect recovery now keeps the last confirmed host/audience state in the current browser and refreshes from the server after reconnecting. Commit `432b6ba`.
- Player pages now explain when the host has paused new joins and disable the join action.
- Fast Money now labels expiry versus a manually completed turn, explains pass-and-return behavior and presents final totals in a dedicated live summary. Commit `691a24d`.
- Hosts can mute or re-enable audience and Cast sound independently while board updates continue. Commit `5dfbb24`.
- Host diagnostics provide a trusted handoff link and show the number of connected host desks so a second signed-in device can take over safely. Commit `9549cc7`.
- Host diagnostics now show current Cast sender/device status and the latest server response time.
- All generated game, audience, buzzer, survey and host-handoff URLs use `https://ff.adeticket.com`; legacy game subdomains redirect there while preserving path and query string.
- Azure deployment applies an explicit `APP_ORIGIN` allowlist. Its production smoke step sends a safe invalid-password request from the deployed host and fails if the server replies `Origin not allowed`.
- Alpha release notice now appears on the player and audience room-code entry forms, as well as the in-game player screen.
- Fixed the missing alpha notice on `/play` and `/join` and corrected the survey success and player approval browser selectors. Commit `a4f797c` passes the Playwright browser suite.
- Alpha status is clearly labelled across host, audience, player and survey surfaces. Commit `40d83f4`.
- Visible branding is now Friends Showdown. Commit `bfe380f`.
- Game cleanup, question history, themes, audience sounds and Cast receiver integration are already in `main`.
- Ihechi’s audience theme now uses burgundy and earth tones. Commit `765ca06`; GitHub validation, Playwright, Azure deployment and production smoke checks passed.
- Player and audience join-code pages now expose a main landmark; Playwright checks core-page landmarks and labeled join fields. Commit `b2b2bbed`; validation, browser tests and Azure smoke checks passed.

## P0 — verify before a major event

- **Canonical domain/origin fix — verified:** commit `4bb6e78` passed validation, Playwright, Azure deployment and production smoke checks. Smoke confirmed `POST /api/login` from `https://ff.adeticket.com` reached login validation (401), not the origin-rejection response (403). Local tests cover both legacy redirects; direct external requests to the legacy hosts are not accessible from this environment.

- **Deployment verification:** application release `b2b2bbed` passed GitHub validation, Playwright, Azure deployment and production smoke checks. Direct production HTTPS requests from this environment fail TLS, so Azure smoke checks are the current live-route evidence. Before an event, rehearse survey creation, join locking and host diagnostics on the deployed site.
- **Scraper calibration:** current references include a partial board with 4 of 8 answers visible and a separate complete 8-answer board; they verify OCR text but are not a matched calibration pair. The supplied video sample reaches 7 of 8 answers before the scene changes. Capture clean partial and complete frames from one matching board sequence, tune slot geometry/completion detection, then validate a full episode with question matching and variable answer counts.
- **Cast acceptance:** test the registered receiver on the actual Google Cast TV for discovery, handoff, reconnect, board updates and audio. Build and test the iPad sender wrapper on macOS.

## P1 — game-night reliability

- **Offline recovery:** short-outage state retention is shipped; longer-outage reconciliation and conflict messaging remain to be tested and hardened.
- **Host handoff:** the trusted-link and connected-host-count flow is shipped. The Playwright takeover test verifies buzzer-control synchronization across independently signed-in desks; raw socket counts can fluctuate and are informational rather than a device count. The latest full browser run passed. A live two-device rehearsal is still required.
- **Fast Money polish:** expiry sound, timer-expiry messaging, pass-and-return wording and final-results presentation are shipped. Remaining work is optional visual refinement after a live game-night rehearsal.
- **Moderation:** add join-code regeneration. Treat as a deliberate identity migration: the current code is the game’s primary key across persistence, routes and socket rooms. Locking joins, player-facing status and independent audience-sound control are shipped.
- **Diagnostics:** current Cast sender/device status and latest server response time are now shown. Confirm accuracy during a live TV session.

## P2 — presentation and accessibility

- Audience audio: original, more differentiated buzz/reveal/strike/timer/win cues are implemented; listen on the actual TV and adjust levels and tone to suit the room. The Nigerian Family Feud broadcast is a pacing reference, not an audio source. The native Apple TV receiver still needs its own sound implementation.
- Audience layouts: board-only, scoreboard-only, waiting room, QR join and final-score modes.
- Downloadable scorecard with round winners, steals, Fast Money totals and timestamps.
- Reusable event templates for team names, themes, question packs and sponsor text.
- High-contrast mode, reduced motion, larger text, keyboard focus and screen-reader audit.
- Basic Playwright accessibility smoke checks for core page landmarks and join-form labels are shipped. Full WCAG/axe audit, keyboard/focus, contrast, reduced-motion and screen-reader review remain.

## P3 — operations and growth

- Load testing with a host, audience screens, two teams and many phone buzzers.
- Deployment error logging and a small game-night status page.
- AdSense site review, certified consent management and real ad-delivery testing; ads remain disabled.
- Sponsor mode with an event-specific logo/message switch.
- Paid custom question packs or hosted event packages.
- Aggregate game analytics with an explicit privacy choice.

## Working rules

- Do not claim a feature is live until the corresponding GitHub Actions/Azure run and a production check succeed.
- Do not enable advertising until AdSense approval, consent management and rollback testing are complete.
- Keep the scraper’s uncertain boards in review status; never export a partial board as verified.

## Completed locally — Ihechi's birthday bank (30 September 2026)

30 regular questions and 153 source answers added in .deploy/ihechi-birthday; import-ready JSON is in outputs/naija-feud/question-banks/ihechi-birthday.json. Focused API/privacy tests 7/7, typecheck and build passed. Built-in release remains unpublished. Source questions 26/27 total 170; scores retained. Fast Money and unscored lightning questions excluded because the supplied data does not meet bank requirements. Next: import and select the pack, or authorize publication of the built-in integration.

### Birthday survey — created live (30 September 2026)

All 30 regular prompts are collecting answers at https://ff.adeticket.com/survey/7a0c3545aaa500533383 . Public form and unauthenticated API inspected; no scores/answer suggestions included and no fabricated responses submitted. Next owner step: share link, close when ready, group/review results, then save the surveyed bank. No code deployment required.

### Birthday Fast Money survey — created live (30 September 2026)

Reuses source questions 1, 2, 12, 21, 24 in a separate five-question fast-money survey: https://ff.adeticket.com/survey/6fb8c61b5ea32a135208 . UI and unauthenticated public API verified; no sample responses. Next: collect/review results, save Fast Money bank and omit those five from regular gameplay.

### Birthday survey without red-flag question — completed live (1 October 2026)

29-question survey created at https://ff.adeticket.com/survey/69d5e8ce093451997556 . Only source question 16 omitted. Existing surveys unchanged. Public form checked for 29 fields and absent removed prompt; no test submissions. Next: share and collect, then close/review/export.

### Shared-bank Fast Money + usage cap — implemented locally, verification pending

Type: game setup/replay UX; priority P1. Opt-in one bank supplies regular and five reserved Fast Money questions; rotate final set; exclude at owner-specified distinct saved-game use count across both modes. Acceptance: no regular/final overlap, at least five regular boards, attainable 200-point final, cap honored on both client and fresh server history; separate-bank mode unchanged; existing games untouched. Four dependency-free helper tests pass. API regression added; typecheck/build/browser/API runs blocked by unreadable installed dependencies. Files: Setup.tsx, app.ts, contracts/questionSelection.ts and setupSchema; tests/birthday-bank.test.ts. Next: restore dependency access, verify local UI/API/build, then seek release authorization. Not deployed.

### Release follow-up — publication blocked

Owner authorized release. Main confirmed at 162dcea via GitHub read. Repository write attempt refused because approval is required while session policy forbids approval; no main update or deploy. Temporary verification workflow removed. Phone-friendly Fast Money checkboxes and history refresh added locally; pnpm test now includes 4 passing Node selection regressions. Full formatter/typecheck/Vitest/build/browser verification still required after dependency access is restored. Next: verified release in a publication-enabled session. Existing surveys and games unchanged.

### Requested improvements 2, 5, 6 — implemented locally; verification/release pending

| Item                             | Priority/type          | Benefit and testable acceptance                                                                                                                                                                                                                               | Status / next action                                                                                                                   |
| -------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 2. Question-mix preview          | P1 / host UX           | Host sees eligible regular pool, exact reserved Fast Money prompts and cap-excluded questions from each bank; shuffled/required-group order is described accurately; preview never records use.                                                               | Implemented in Setup.tsx. Verify phone layout and shared/separate-bank previews after dependencies are readable.                       |
| 5. Event readiness               | P1 / event reliability | Shows audience connection and active approved face-off phones for both teams. Socket counts alone never confirm picture/audio. Manual confirmations, intentionally silent and spoken-answer options work without changing scores or blocking normal controls. | Implemented in BuzzerControls.tsx/lib/eventReadiness.ts. Three Node readiness regressions pass. Real screen/audio/phone check pending. |
| 6. Selected Fast Money rehearsal | P1 / hosting practice  | Rehearse chosen five in game pack order with timer, pass/return, duplicate-answer and reveal guidance. Fresh independent rehearsal has no impact on real game or question-use counts; invalid IDs/packs/sets rejected.                                        | Implemented in Setup.tsx, app.ts/rehearsal.ts and RehearsalControls.tsx. Selected-set factory/API regressions added, Vitest blocked.   |

Dependencies: readable installed packages for formatter/typecheck/build/API/browser checks; repository publication permitted for release. Seven dependency-free selection/readiness regressions pass; diff check passes. Not deployed. Existing owner release authorization persists, but GitHub write action was refused under this session's approval policy. Next: finish these checks before publication; do not classify device or release acceptance as completed.

### Release verification — 1 October 2026

Previous dependency/publication blockers are resolved in this session. Birthday bank, shared-bank selection/usage cap and requested improvements 2/5/6 pass typecheck, build, 93 Vitest tests, seven Node regressions and 18 Chromium browser tests (including 390px preview/rehearsal/readiness/no-overflow). Scoped release fixes: test-runner separation, transitive ip-address security patch, SPA fallback in hidden local checkout and UI regression selectors. Final order-alignment rerun passed before push. Release status: not yet deployed; next verify GitHub Actions/Azure and live bundle. Physical TV sound, casting and phone latency still require an owner device check.
