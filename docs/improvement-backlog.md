# Improvement backlog

This list separates game-night reliability from optional product ideas. Items marked done already exist in the current release; the rest are candidates for later work.

## Next reliability work

- **Cast acceptance test** — test the registered receiver on the user’s Google Cast TV and verify launch, room handoff, reconnect, audience updates and sound. The web sender cannot run on iPad browsers; an iPad sender requires a native iOS wrapper using Google’s iOS Cast SDK.
- **Fast Money expiry sound** — play the time-up cue when the server changes a turn to reveal, even when the state update arrives before the client’s countdown reaches zero.
- **Live release smoke test** — after each deployment, check health, host sign-in, player join, audience board, `/cast`, `/ads.txt`, and the configured Cast application ID.
- **Host recovery** — add a reconnect banner with the last confirmed revision, safe retry, and a clear “resume from server state” action.
- **Game cleanup** — add host confirmation, bulk selection, and retention filters to the existing old-game deletion view.
- **Offline game-night fallback** — preserve the last audience board and host state locally during a short network interruption, then reconcile from the server after reconnecting.
- **Host handoff** — allow a second trusted host device to take over a room if the original host tablet or laptop fails.
- **Room diagnostics** — add a host-only panel showing server connection, audience connections, buzzer connections, Cast state, and the last state update time.

## Host and player experience

- **Theme packs** — extend the current Classic, Ihechi birthday and Midnight presets with custom logo upload, celebratory confetti toggle, sponsor line, and a saved event template.
- **Audience display modes** — provide board-only, scoreboard-only, waiting-room, QR join and final-score layouts for projectors and TVs.
- **Accessibility** — add high-contrast mode, reduced motion, larger answer text, keyboard focus treatment, screen-reader labels, and a visible buzzer result announcement.
- **Player readiness** — show team assignment, stage status, connection quality, and a host-controlled “ready” state before the round begins.
- **Game-night export** — provide a downloadable scorecard and event summary with round winners, steals, Fast Money totals and timestamps.
- **Event templates** — save team names, theme, rules, question packs and sponsor text as a reusable event setup.
- **Moderation controls** — let the host remove a player, lock new joins, regenerate the join code, and mute audience sound independently from board updates.
- **Buzzer fairness view** — show the server-recorded buzzer timestamp and winning device to the host for disputes.

## Question libraries and surveys

- **Answer review queue** — record accepted answer variations and let the host approve or reject them without editing the canonical answer.
- **Question history** — warn when a question was recently used and filter by regular-round versus Fast Money usage.
- **Survey collection** — add a shareable survey link with one response per participant, duplicate-response controls, export, and question-bank import validation.
- **Scraper calibration** — collect Nigerian board screenshots, tune slot geometry and completion detection, then validate complete-board selection across several videos before batch mode.
- **Question quality scoring** — flag duplicate prompts, suspicious point totals, missing questions, and incomplete scraped boards before import.

## Operations and growth

- **Monitoring** — add deployment health checks, error logging, and a small status page for game-night incidents.
- **Privacy and ads** — finish consent configuration and AdSense review only after both root sites are reachable; keep game ads disabled until consent and approval are verified.
- **Native iPad sender** — package the audience sender as an iOS app or wrapper with the Google Cast iOS SDK if iPad casting is a requirement.
- **Event analytics** — track only aggregate games started, completed rounds, and player joins with an explicit privacy choice.
- **Load testing** — simulate a host, audience screens, two teams and many player buzzers to find socket and timer limits before a large event.
- **Accessibility audit** — run keyboard, screen-reader, contrast and reduced-motion checks in CI so visual improvements do not regress usability.
- **Localization** — make game labels, instructions and Fast Money prompts translatable while preserving Nigerian wording in the question bank.
- **Sponsor mode** — add a controlled sponsor logo/message slot to themed audience screens with a per-event enable switch.
