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
- **Host handoff:** the trusted-link and connected-host-count flow is shipped. The second-host takeover Playwright test passed in commit `821c098`; diagnostics report raw sockets and can exceed device count, so the test checks 2+ plus synchronized controls. A live two-device rehearsal is still required.
- **Fast Money polish:** expiry sound, timer-expiry messaging, pass-and-return wording and final-results presentation are shipped. Remaining work is optional visual refinement after a live game-night rehearsal.
- **Moderation:** add join-code regeneration. Treat as a deliberate identity migration: the current code is the game’s primary key across persistence, routes and socket rooms. Locking joins, player-facing status and independent audience-sound control are shipped.
- **Diagnostics:** current Cast sender/device status and latest server response time are now shown. Confirm accuracy during a live TV session.

## P2 — presentation and accessibility

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
