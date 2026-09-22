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
- Alpha status is clearly labelled across host, audience, player and survey surfaces. Commit `40d83f4`.
- Visible branding is now Friends Showdown. Commit `bfe380f`.
- Game cleanup, question history, themes, audience sounds and Cast receiver integration are already in `main`.

## P0 — verify before a major event

- **Deployment verification:** confirm the GitHub Actions, Azure deployment and smoke checks for commits `946a5aa` and `bfe380f`; test survey creation, join locking and diagnostics on the live site.
- **Scraper calibration:** capture matching partial and complete Nigerian board screenshots, tune slot geometry and completion detection, then validate a full episode with preceding spoken questions and variable answer counts.
- **Cast acceptance:** test the registered receiver on the actual Google Cast TV for discovery, handoff, reconnect, board updates and audio. Build and test the iPad sender wrapper on macOS.

## P1 — game-night reliability

- **Offline recovery:** preserve the last board and host state during a short outage, then reconcile safely from the server.
- **Host handoff:** allow a second trusted host device to take over a room if the original device fails.
- **Fast Money polish:** improve pass-and-return wording, timer visibility and the final results presentation; expiry sound is complete.
- **Moderation:** add join-code regeneration, a clearer “lock joins” state on the player page and independent audience-sound mute control.
- **Diagnostics:** add a visible audience Cast status and last server-update timestamp to the host panel.

## P2 — presentation and accessibility

- Audience layouts: board-only, scoreboard-only, waiting room, QR join and final-score modes.
- Downloadable scorecard with round winners, steals, Fast Money totals and timestamps.
- Reusable event templates for team names, themes, question packs and sponsor text.
- High-contrast mode, reduced motion, larger text, keyboard focus and screen-reader audit.
- Automated accessibility checks in CI.

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
