## 10 October — Bounded request recovery deployed

Release d338777 is live. Azure38030032418, validation38030032429, browser38030032454 and Push on main38030032321 succeeded. Production smoke passes; live index-DSsVddey.js contains timeout recovery wording. N2 request deadline slice complete/deployed: stalled headers/body abort after15 seconds, no automatic command retry, host controls recover after state refresh. Ten API and five host browser regressions pass locally; full CI succeeds. Actual restart and TV rehearsal remain pending F2/F4; screen-reader work deferred. No owner records/schema changed. Usage reached15% five-hour remaining; stopped feature work and completed release. Next: owner uses normal game controls, then coordinate controlled persistence/device rehearsal or scope N1 alias migration. No reset credits redeemed.

## 10 October — N2 bounded request recovery; usage checkpoint

Confirmed shared API requests had no deadline and could leave host busy indefinitely. Added 15-second abort deadline covering headers and body, cleanup on completion, actionable timeout wording and no automatic retry. A timed-out write is explicitly uncertain, never claimed unapplied. Ten focused API tests pass including stalled headers/body and timer cleanup. Five host browser tests pass, including phone-width stalled command, released controls, one command only and successful subsequent action. Typecheck/build passed before final read-only wording refinement; CI will validate final source. Files: apps/web/src/lib/api.ts, tests/client-api.test.ts, e2e/host-recovery.spec.ts. No data/schema changes. Deployment pending. F2/F4 real restart/hardware remains open; screen-reader work deferred. Usage85% five-hour used (15% left),74% weekly used. Next: commit/push, verify CI/Azure/live smoke, checkpoint and stop. No credits redeemed.

## 9 October — Early-end protection deployed

Release 0ce1bc3 is live at ff.adeticket.com. Azure 38015999172, validation 38015999121, browser 38015999123 and Push on main 38015999245 succeeded. Production smoke passes; live index-CXf0tVV8.js returns 200 and contains confirmation text. Fast Money early-end protection complete/deployed; mobile cancellation/confirmation and draft isolation verified locally. No records/schema changed. Next: owner checks confirmation on iPhone; coordinate F2 persistence restart and F4 real hardware validation separately. Screen-reader work stays deferred. No paid resources or reset credits used.

## 9 October — Fast Money early-end protection

Confirmed a single End turn & reveal tap immediately ended a running turn. Added confirmation showing the recorded-answer count and explaining that drafts do not score; cancellation preserves the turn and draft, without pausing the authoritative timer. Automatic five-answer completion and expiry are unchanged. Phone-width Playwright regression passes cancellation, confirmation, reveal and player-two draft isolation. Typecheck/build/format pass. Files: apps/web/src/components/FastControls.tsx, e2e/fast-drafts.spec.ts. Implementation complete; deployment pending. Next: push main, verify workflows and production smoke. Physical iPhone dialog behavior remains owner verification. F2/F4 device/restart checks still open; screen-reader work deferred. Usage 63% five-hour used,71% weekly used; no credits redeemed.

## 9 October — API recovery wording deployed

Release8ec69e0 is live. Azure38015109749, validation38015109729 and browser38015109769 all succeeded. Production smoke passes; live index-BQVZSpH4.js200 contains unreadable-response guidance. Seven focused API tests and four host browser checks passed locally. N2 malformed-response handling complete/deployed; actual restart/hardware rehearsal remains open. Screen-reader work remains deferred. No owner data/schema changed. Next: choose the next independently testable gameplay improvement or coordinate F2/F4 device/restart validation. No reset credits redeemed.

## 9 October — N2 unreadable API response recovery prepared

Confirmed api.ts blindly parsed every response as JSON, so HTML/empty outage responses surfaced parser errors. Now returns actionable HTTP/recovery wording, preserves valid server conflict messages, and never retries writes or asserts an uncertain action failed. Seven client API regressions pass (HTML502, malformed success, null/object/empty error, conflict and success). Typecheck/build and four host-recovery browser tests pass. First Vitest attempt hit sandbox temp-file EPERM; rerun outside that restriction passed. Files: apps/web/src/lib/api.ts, tests/client-api.test.ts. No state/schema changes. Release pending. Next: push, verify CI/Azure/browser and live smoke. N2 production-outage rehearsal remains open; screen-reader work deferred. Usage start3% five-hour used,61% weekly; no credits redeemed.

## 9 October — Both authorized releases deployed

First release100f1e1 deployed: Azure37942825981, validation37942825980 and browser37942826037 all succeeded. Fast Money typed drafts survive navigation/passing, remain unrecorded until explicit record, and clear before player two; prior prepared question-status change included. Second releaseabecd5e deployed: Azure37977848428, validation37977848435 and browser37977848420 all succeeded. N5 survey export now states submissions are not verified unique people and explains cookie-based duplicate protection; same-cookie/fresh-cookie and export-notice regressions pass. Post-deploy smoke passes health/config/cast/ads.txt and canonical write-origin validation. No authenticated production survey export was created merely for verification; behavior is covered by local API tests and successful deployment. No owner records or schema changed.

Backlog: Fast Money draft fix complete/deployed. N5 survey-integrity slice complete/deployed; many-phone performance and safe venue-size validation remain open. N3 further screen-reader work deferred by owner. F2 restart and F4 hardware rehearsal still require controlled owner/device access. Next: scope an independent host/gameplay improvement or coordinate those rehearsals; do not mark them complete from public smoke checks. Usage at start5% five-hour used,57% weekly; no reset credits redeemed.

## 9 October — two authorized releases in progress; usage checkpoint

Owner authorized deploy, backlog work, deploy again. First release100f1e1 pushed main: Fast Money drafts plus already prepared question-status change. Validation37942825980 succeeded; Azure37942825981 and browser37942826037 pending. Next N5 survey-integrity slice prepared: exported bank notice explicitly says submissions are not verified unique people and explains cookie-reset/other-browser limitation. Two focused survey tests pass, including same-cookie duplicate count1 versus fresh-cookie count2 and exported notice. No production responses modified. Many-phone load and safe event-size claims remain unverified; do not close all N5. Screen-reader work remains deferred. Usage89% five-hour used (11% remaining), weekly55% used; no reset credits redeemed. Next: finish first release checks, commit/push survey notice/tests as second batch, verify Actions/live smoke, checkpoint and stop.

## 9 October — Fast Money drafts preserved; screen-reader work deferred

Owner asked to ignore screen-reader work and continue practical improvements. Existing N3 edits remain local and unchanged; no further screen-reader work. Fixed confirmed FastControls behavior where switching questions or passing discarded typed off-board answers. Drafts now stay keyed by question for the current player/turn, are cleared after successful recording and on player change, and never count as entries before Record. Reload clears drafts; UI states that limit.

Backlog item: Fast Money draft preservation (UX/P1) implemented locally. Acceptance verified at390x844: type two drafts, navigate/pass/back, confirm zero recorded, explicitly record one, retain other, end/reveal turn and ensure player two starts empty. Dedicated e2e/fast-drafts.spec.ts passes. Typecheck/build/format pass. Relevant files: apps/web/src/components/FastControls.tsx and e2e/fast-drafts.spec.ts. No schema, scoring or production record changes. Not deployed. Next: owner selects next focus (host controls, survey/question workflow or audience/sound); publish only with deployment authorization. F2/F4 real restart/device checks remain; N3 deferred by owner. Start usage54% five-hour used,49% weekly; no credits redeemed.

## 9 October — N3 Fast Money question announcements verified locally

Current release checkout `.deploy/ihechi-birthday` was clean and HEAD matched fetched origin/main ba30f28. Investigated highest remaining work: F2 production restart and F4 physical devices require owner coordination; no production restart attempted. For N3, FastControls advanced the private question without a live announcement. Added visible Question X of 5 and a polite, atomic, named status region to the running-turn prompt. No audience answer exposure or game-state changes. The proposed pause-control defect was disproved: Host already passes paused/disconnected state into busy.

Files: apps/web/src/components/FastControls.tsx and e2e/game.spec.ts. Typecheck/build passed; focused Playwright rehearsal passed on desktop and 390x844, covering record/auto-advance, pass and manual question return. Initial pnpm test launcher stalled; stopped only that process and reran the installed Playwright CLI with local socket permissions successfully. Formatting/diff checks checked; real VoiceOver/NVDA output remains unverified. N3 stays open for broader review. Changes are local and not deployed; no credentials, owner records or infrastructure changed. Next: review this scoped diff and obtain fresh deployment authorization before publishing; follow with physical screen-reader and F2/F4 rehearsals. Usage at start five-hour3% used, weekly41% used; no reset credits redeemed.

## 6 October — weekly highlights and host shortcuts deployed

Fitness e1a6b7d deployed successfully: Actions37561067204. Live app.js200 contains Recorded highlights; anonymous weekly-review401. I5 implemented/deployed: dated workout/recovery highlights, recorded-step coverage, sparse/empty labels, no automatic plan or nutrition changes.72 Node tests pass. Actual authenticated owner/iPhone review not performed.

Friends Showdown8e10f20 deployed successfully: Azure37561077678, validation37561077732, browser37561077700. Live index-BsptYRPO.js200 contains shortcut toggle; production smoke routes/origin pass.102 local unit/helper tests,4 focused keyboard browser tests, build/typecheck/audit pass; complete browser suite passed in CI. N3 shortcut opt-out complete; physical screen-reader/contrast and F2/F4 hardware/restart rehearsal remain open.

No owner records, schema, DNS or paid resources changed. Next fitness: I4 optional baseline/cadence design or I6 private calendar for Sol; next game: remaining N3 verified accessibility issues, with hardware-dependent tasks separately scheduled. Release checkouts remain fitness-tracker/.deploy/accountability-link and .deploy/ihechi-birthday. Owner-removed infrastructure and paused OCR remain excluded.

## 6 October — weekly highlights and host shortcut control prepared

Fitness I5: weekly review highlights list completed-workout dates, recorded planned recovery dates and step coverage, with sparse/empty wording. Missing days never imply failed workouts; no food-compensation or automated target changes. Future-dated workouts/reviews/activity do not enter current-week highlights or counts. Files: weekly-review.js, weekly-review.test.js, public/app.js. Five focused weekly tests pass, including empty/future/sparse cases; syntax passes. Existing schema and records unchanged.

Friends Showdown N3: added an explicit host single-key shortcut toggle with key descriptions and page-lifetime scope. When off, answer/strike/undo keys do nothing while buttons remain available. Files: Host.tsx, e2e/host-recovery.spec.ts. Typecheck/build and four keyboard/dialog/reconnect browser tests pass. Physical screen-reader/contrast and hardware rehearsals remain unverified. Both fetched origin/main match release HEAD before changes. Deployment authorized; next finish release checks, push both scoped commits and verify Actions/live assets.

## 5 October — fitness and Friends Showdown releases complete

Fitness51e1143 deployed successfully in Actions37403525999, following equipment release42901ec. Live app.js200 confirms both features; anonymous recent-foods/progress return401. I2 inline equipment creation and I3 recent-food shortcuts are complete/deployed. 70 Node tests plus synthetic phone equipment and recent-food flows pass; actual iPhone remains owner verification.

Friends Showdownb126860 deployed: Azure37403548213 attempt2 succeeded including production smoke. Validation37403548168 and browser37403548096 succeeded. First attempt was aborted by Windows OneDeploy during copy; retry resolved it without code/config changes. Live index-Dk3rOXoc.js matches tested bundle. Player readiness text and library dialog focus shipped; proxy-addr2.0.8/source-map-js1.2.2 patch the audit findings.102 unit/helper and23 browser tests pass, audit clean, typecheck/build/format pass.

No owner records modified or new paid resources provisioned. Shared/root backlogs reconciled. Next: fitness I4 optional baseline/cadence design or Sol I5 factual weekly highlights; game N3 broader physical screen-reader/contrast review, and F2/F4 controlled production/hardware rehearsal. Removed infrastructure items and paused OCR remain excluded. Working release paths: fitness-tracker/.deploy/accountability-link and .deploy/ihechi-birthday. Do not use the dirty root fitness source as the release checkout.

## 5 October — N3 library focus fixes and release audit repair

Question editor and import-review dialogs use the existing focus trap, Escape handling and trigger restoration. Player checklist text improvements included. Editor/host/reconnect browser checks pass; 102 unit/helper tests, typecheck and build pass. Initial game release bce5aad was blocked before Azure deployment by dependency audit. Updated only proxy-addr2.0.7→2.0.8 and source-map-js1.2.1→1.2.2 in lockfile; audit now reports no known vulnerabilities. Final release/browser checks pending. Broader N3 physical screen-reader/contrast review and F2/F4 production/hardware rehearsal remain open.

## 5 October — N3 player readiness accessibility; locally verified, not deployed

Player checklist now exposes each state in visible text instead of relying on colour/symbols; atomic status updates announce the whole message. Typecheck, build and focused browser join/approval/stage/buzz test pass. Files: apps/web/src/pages/Player.tsx, e2e/game.spec.ts. N3 remains open for broader keyboard, screen-reader, contrast and reduced-motion walkthroughs. F2/F4 owner/device rehearsal unchanged. No application publication this pass.

## 4 October — host reliability/accessibility deployed6e27261

N2: disconnected commands now explicitly rejected without queueing; synthetic two-host offline/reconnect convergence passes. Existing stale-revision handling retained. Longer production restart and multi-device/hardware rehearsal remain F2/F4; no claim those passed. N3: Audience/roster dialogs now trap Tab, focus initial control, close with Escape from inputs/buttons and restore trigger. Phone keyboard regression passes. Remaining N3: broader screen-reader/contrast review outside these dialogs. Typecheck/build and102 unit/helper tests pass; all22 browser tests pass. Azure37254983959, Validate37254983961 and Browser37254983975 succeeded; live bundle and health200. No backend state/schema changes.

## 4 October — scorecard audit details

N4 implemented: each newly settled round stores server-command time and clear/successful-steal/failed-steal/sudden-death outcome; host results and formula-safe CSV show details. Older awards label unavailable metadata; score totals and undo unchanged. Typecheck,95 Vitest+7 Node tests, build/format and20 browser scenarios pass. Catalogue keyboard skip link also implemented. Deployed ed4abfa; Azure37246208973, validation37246209013 and browser37246209022 succeeded. Live game bundle confirms audit labels; catalogue200 with skip link. Owner hardware/production rehearsal remains.

## 2 October released N2 messaging

Scoped stale-host messaging deployed inbebdd43. Azure37058711420, CI37058711700 and browser37058711643 succeeded; live JSindex-Bhv51HVi contains both messages. Two-host success/failure regressions pass; broader outage/restart/device validation remains outstanding. Earlier pending messaging notes are superseded.

## 2 October verification update

N2 stale-host messaging is locally verified: build/typecheck and two two-host browser regressions pass, including failed snapshot refresh. Deployment pending; broader restart/hardware recovery remains unverified. Historical local-only/pending sections for the 1 October birthday/mix/readiness/rehearsal release are superseded by the Latest release section and are not outstanding work.

## 2 October local N2 update

Stale-command wording no longer claims a refresh before it succeeds. Client distinguishes refresh success/failure. Typecheck and four reliability tests passed; two-host/outage browser regression and deployment remain pending. N2 is not complete. No production restart or hardware check performed.

## Latest release — 1 October 2026

Released in 6c9ad06 at https://ff.adeticket.com. Azure deploy/production smoke (36942037370), CI (36942037435) and Playwright workflow (36942037531) succeeded. Live JS /assets/index-Dfs_4WER.js contains the new controls; public route/origin checks pass. Previous local-only and blocked release entries below are historical, superseded by this section.

| Completed item                          | Evidence                                                                                                     | Remaining owner verification                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Birthday bank and shared-bank/cap setup | API/privacy/cap regressions; deployed release                                                                | Review real survey answers before treating scores as surveyed data. |
| 2. Question-mix preview                 | 390px browser test verifies separated regular/final pools; final order aligned across preview/game/rehearsal | Confirm preferred selection before the event.                       |
| 5. Event readiness                      | Three deterministic regressions and phone-width browser toggles; connections alone never prove audio/picture | Actual TV picture/audio and staged phones.                          |
| 6. Selected Fast Money rehearsal        | Factory/API and mixed-selected-five browser test; rehearsals leave usage counts unchanged                    | Practise timed turns and point reveals with the actual display.     |

Checks: 93 Vitest + seven Node tests, 18 Playwright tests, typecheck, build, formatting, diff and clean dependency audit. No remaining implementation/release blocker for these items. Real hardware audio/casting/latency and authenticated production feature checks remain device verification, not completed claims. No paid resources provisioned.

# Friends Showdown improvement backlog

Reconciled 22 September 2026 against the local source tree, shared `PROJECT_STATUS.md`, and GitHub `main` at `de05c54d`. A source finding is not proof of a production failure. The local checkout is older than remote `main` and has unrelated uncommitted work; reconcile it before implementation. The separate Python scraper remains the owner's stated question-bank priority.

Already shipped, so not outstanding: game deletion, player self-registration/approval and stage-gated buzzers, required question groups, separate Regular/Fast Money libraries, Fast Money expiry/results, brief-disconnect state retention, survey review/export, scorecard CSV download, audience themes/sound, alpha notices, canonical `ff.adeticket.com` links/origin configuration, and basic join-page accessibility checks. Real-device and production verification are tracked below.

## Fix now

### F2. Rehearse production persistence and multi-device recovery

- **Type / priority:** Data/reliability validation / P0.
- **Why:** Production requires `DATA_DIR`, but authenticated Azure restart recovery and a real host/player/audience rehearsal are not in the verification record. A health endpoint does not prove saved-game durability.
- **Acceptance:** Create a disposable deployed game, register/approve a player, reveal an answer, restart the App Service, and confirm game, roster, score, pack and revision survive. Confirm reconnect and clear stale-command conflict. Record date and deployed commit, then delete the disposable game. No restore feature is requested.
- **Dependencies:** Owner's authenticated host session and controlled Azure restart window; never restart during a live event.
- **Files:** `apps/server/src/index.ts`, `store.ts`, `apps/web/src/hooks/useGame.ts`, `docs/azure-deployment.md`, `docs/verification.md`.

### F3. Reconcile the dirty local checkout with remote `main`

- **Type / priority:** Delivery/process risk / P0.
- **Why:** Local HEAD is `13393afb`, remote `main` was `de05c54d` at audit, and the working tree has unrelated modifications and untracked runtime data. Deployment from this checkout could revive old code or lose work.
- **Acceptance:** Compare local changes with current remote `main`, preserve intentional edits and runtime data, create a clean reproducible branch/worktree at current remote, and pass game checks there. No deployment in this audit.
- **Dependencies:** Review every existing local diff; Git authentication only for later publication.
- **Files:** Git history/working tree, `.github/workflows/`, `PROJECT_STATUS.md`.

### F4. Validate Cast and host takeover on actual devices

- **Type / priority:** Event-readiness test gap / P0.
- **Why:** Cast sender/receiver and browser takeover tests exist, but TV discovery, reconnect, sound and iPad sender behavior have not been demonstrated on the owner's hardware.
- **Acceptance:** Record a real-TV run covering discovery, handoff, board/score updates, sound toggle and reconnect; verify a separately signed-in second host controls buzzers without duplicate winners. Log defects with device versions. Build/test the iPad wrapper separately on macOS.
- **Dependencies:** Owner's Cast TV, iPad and macOS environment for native build.
- **Files:** `apps/web/src/lib/cast.ts`, `pages/CastReceiver.tsx`, `components/CastControls.tsx`, `apps/ios-cast-sender/`, `e2e/game.spec.ts`.

## Next up

### N1. Separate the rotatable join code from the internal game ID

- **Type / priority:** Security/moderation architecture / P1.
- **Why:** The six-character public code is the SQLite game primary key and route/socket room key. A leaked code cannot be rotated without disrupting the game; locking new joins is a partial mitigation.
- **Acceptance:** Host rotates a public join alias while game ID, score, host/audience sessions and approved players persist; old alias stops new joins; links/QR update; stale alias gives a clear error; authorization and concurrent-buzzer tests pass.
- **Dependencies:** Alias lifecycle and migration for existing saves; compatibility plan for current room URLs.
- **Files:** `apps/server/src/app.ts`, `store.ts`, `buzzers.ts`, `packages/contracts/src/index.ts`, `apps/web/src/pages/Player.tsx`, `components/BuzzerControls.tsx`, `tests/player-registration.test.ts`.

### N2. Harden longer-outage conflict messaging

- **Type / priority:** Reliability/UX / P1.
- **Why:** Short disconnects retain a confirmed snapshot, but conflicting host edits after a longer outage have not been rehearsed end-to-end.
- **Acceptance:** Two hosts edit the same game across a simulated disconnect; stale commands never overwrite the newer revision; the disconnected host sees authoritative state and a specific recovery message; audience/player views converge.
- **Dependencies:** F2 rehearsal findings.
- **Files:** `apps/web/src/hooks/useGame.ts`, `pages/Host.tsx`, `apps/server/src/store.ts`, `tests/reliability.test.ts`, `e2e/game.spec.ts`.

### N3. Complete accessibility review beyond basic join labels

- **Type / priority:** UX/test gap / P1.
- **Why:** Basic landmark/label tests exist, but keyboard/focus flow, contrast, reduced motion and screen-reader announcements across host and player screens are not covered.
- **Acceptance:** Document keyboard and screen-reader walkthroughs for join, approval, buzzing, host answers and Fast Money; fix blocking issues; add automated semantic checks plus manual contrast/motion checks.
- **Dependencies:** Browser/device access and supported screen-reader/browser pair.
- **Files:** `apps/web/src/App.tsx`, `pages/Player.tsx`, `pages/Host.tsx`, `styles.css`, `e2e/game.spec.ts`.

### N5. Measure many-phone performance and survey sample integrity

- **Type / priority:** Performance/security validation / P2.
- **Why:** A single process serves Socket.IO, polls timers and uses SQLite; no venue-scale phone load result is recorded. Survey duplicate limits are cookie-based, so counts represent submissions, not unique people.
- **Acceptance:** Run a documented host + audience + two-team phone load; report p95 buzz acknowledgment and missed connections; state a safe event size. Survey UI/export label counts as submissions; cookie-reset behavior is tested before stronger claims.
- **Dependencies:** Representative devices/network and agreed event size.
- **Files:** `apps/server/src/app.ts`, `buzzers.ts`, `surveys.ts`, `docs/surveys.md`, `tests/buzzers.test.ts`.

### N6. Validate scraper on a held-out episode and package the update

- **Type / priority:** Data-quality validation and delivery / P1.
- **Why:** F1 now passes its five-round calibration episode; this is not evidence of generalization. The distribution ZIP still predates the local fixes.
- **Acceptance:** Record manual truth on a separate episode before evaluating; report precision, recall, OCR/question errors and runtime without tuning to its final boards. Keep partial/uncertain boards review-only. Rebuild and verify the distributable ZIP, excluding runtime data, environments and secrets. Track other camera views, 5/7-answer layouts and Fast Money graphics separately if absent from the held-out episode.
- **Dependencies:** A separate representative episode/captions; current Python 3.14 source and documented calibration profiles.
- **Files:** `../feud_scraper_py314_v4/feud/scanner.py`, `../feud_scraper_py314_v4/feud/evaluate.py`, `../feud_scraper_py314_v4/docs/episode31-validation.md`, `../feud_scraper_py314_v4/HOW_TO_USE.md`, `../feud_scraper_py314_improved.zip`.

## Nice to have

### H1. Audience modes and reusable event presets

- **Type / priority:** UX / P3.
- **Why:** Operators may want board-only, waiting-room, QR, scoreboard and final-score displays with repeatable teams/themes/question settings.
- **Acceptance:** Host switches audience mode and saves/applies a preset without changing authoritative scores or exposing private answers.
- **Dependencies:** F2/F4 game-night behavior is settled.
- **Files:** `apps/web/src/pages/Audience.tsx`, `components/Board.tsx`, `components/AudienceThemeControls.tsx`, `pages/Setup.tsx`.

### H2. Deployment observability and concise status view

- **Type / priority:** Operations / P3.
- **Why:** Health/smoke checks catch route failures but do not offer a concise view of recent errors and room connection health.
- **Acceptance:** Private diagnostics show actionable connection/revision status; production errors are correlated without logging passphrases or player cookies.
- **Dependencies:** Logging/privacy policy and F2 findings.
- **Files:** `apps/server/src/app.ts`, `apps/web/src/pages/Host.tsx`, `scripts/smoke.mjs`.

### H3. Ads and optional paid event offerings

- **Type / priority:** Monetization/compliance / P3.
- **Why:** Game ad code remains disabled. The adeticket.com Google CMP is published and its ads.txt seller entry is live, but AdSense approval and live consent/revocation/ad delivery remain unverified. The root sites load the AdSense script without a visible site-specific privacy link; the game policy alone does not describe every root site's behavior. Sponsor and paid-pack ideas are not implemented.
- **Acceptance:** After approval/consent, ads appear only in agreed non-gameplay placement, remain absent from host/player/audience screens, and can be switched off promptly. Scope sponsor/premium features separately.
- **Dependencies:** AdSense site review, tested consent management, root-site privacy disclosures/links grounded in actual behavior, and owner decisions. Do not equate published CMP with ads being approved or live.
- **Files:** `apps/server/src/advertising.ts`, `apps/web/src/components/Advertisement.tsx`, `docs/advertising.md`, `docs/monetization-options.md`.

### H4. Confirm exact portfolio credential names

- **Type / priority:** Content accuracy / P3.
- **Why:** The portfolio contains the vague labels “Oracle expertise certification” and “Diploma studies — Algonquin College.” Exact award/course names and completion status cannot be inferred from these labels.
- **Acceptance:** Confirm wording against the owner's resume/certificates, retain accurate completion status, and update only verified details. Do not add work history or invent credentials.
- **Dependencies:** Owner's source documents or confirmation.
- **Files:** `sites/portfolio/index.html`, workspace `personal_site_export/sites/portfolio/index.html`.

## Completed in the focused local run — 23 September 2026

### F1. Calibrate complete-board detection on a real Nigerian episode

- Matched 4/6/8-answer references and five-round manual truth are recorded. Fixed half-frame proxy rounding that skipped samples and prevented round-2 original-frame refinement. Completeness, stability and manual export gates remain unchanged.
- Full episode: 5/5 unique complete/stable regular boards; precision 100%, recall 100%; zero answer/point errors across 32 pairs and zero question errors. Scan 347.222 s plus separately measured 516.97 s proxy preparation. Zero automatic verified exports.
- 37 tests passed; compileall and critical Ruff passed. Independent QA reproduced regression failure with the old expression. Evidence: scraper `examples/episode31/metrics.json` and `docs/episode31-validation.md`. Local source only, no game deployment or ZIP rebuild. Held-out coverage and packaging moved to N6.

### Website wording consistency — completed

- Published game/catalogue53d56bf and root-sites1cdb562: Friends Showdown branding, survey-answer terminology, alpha disclosure, Game code labels, accurate joining instructions and renamed scorecards. Portfolio eyebrow clarified; no credentials invented.
- Typecheck/build,88 unit tests,3 affected local Playwright flows and full GitHub Playwright passed. Azure game/root deployments succeeded; live root/catalogue text and player join screen verified. Follow-ups remain H3/H4, not unfinished copy fixes.

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

Previous dependency/publication blockers are resolved in this session. Birthday bank, shared-bank selection/usage cap and requested improvements 2/5/6 pass typecheck, build, 93 Vitest tests, seven Node regressions and 18 Chromium browser tests (including 390px preview/rehearsal/readiness/no-overflow). Scoped release fixes: test-runner separation, transitive ip-address security patch, SPA fallback in hidden local checkout and UI regression selectors. Final order-alignment rerun pending before push. Release status: not yet deployed; next verify GitHub Actions/Azure and live bundle. Physical TV sound, casting and phone latency still require an owner device check.
