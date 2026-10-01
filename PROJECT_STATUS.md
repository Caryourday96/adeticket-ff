## Released — 1 October 2026

- Friends Showdown release commit 6c9ad06dc127ec41ddb4af5b154a470f1208da15 is deployed at https://ff.adeticket.com. Azure run https://github.com/Caryourday96/adeticket-ff/actions/runs/36942037370 completed successfully, including deployment and production smoke. CI 36942037435 and browser tests 36942037531 also succeeded.
- Live verification: /api/health, /api/config, /cast, /ads.txt return 200; deployed API accepts the ff.adeticket.com write origin and rejects invalid login with 401. Live JS fingerprint /assets/index-Dfs_4WER.js matches local build and contains the question-mix preview, event-readiness and selected-five rehearsal controls. Rendered production host sign-in inspected; no production authenticated games or survey responses created/modified during release checks.
- Released: built-in birthday question bank; shared regular/Fast Money selection and saved-game usage limits; checkbox selection/history refresh; question-mix preview; advisory event readiness; selected-question Fast Money rehearsal/coaching. Preview, real game and rehearsal use the same final-question pack order. Existing games/surveys preserved by no schema or record rewrites.
- Verification: 93 Vitest + 7 Node tests; 18 Playwright tests; typecheck/build/format/diff; clean dependency audit. Release fixes include Node-test exclusion from Vitest, transitive ip-address 10.7.2 and safe root-relative SPA fallback for hidden local checkout paths. Screenshot: outputs/naija-feud/docs/evidence/selected-fast-rehearsal-mobile.png (local rehearsal, 390px).
- Remaining limitations: local/browser tests do not establish real TV audio, casting or phone latency; production authenticated feature flow still needs owner sign-in/device check. Birthday bank retains source illustrative scores; surveyed answers require closing/reviewing the live survey before saving a surveyed pack. No paid resources, DNS, authentication or production workflows changed.
- Exact next action: sign in to ff.adeticket.com, choose the birthday or reviewed survey bank, enable shared bank if desired, preview/mix the five, and rehearse; then use Event readiness with the actual audience display/phones before the event. Earlier local-only/blocker statuses below are historical and superseded by this release.

## Release pushed — 1 October 2026

- Commit 6c9ad06dc127ec41ddb4af5b154a470f1208da15 pushed normally (no force) to Caryourday96/adeticket-ff main from content/ihechi-birthday. Includes birthday bank, shared selection/usage caps, previews, event readiness, selected Fast Money rehearsal and scoped release fixes.
- Final checks: typecheck/build/format/diff pass, audit clean, 93 Vitest + 7 Node tests pass, all 18 Playwright tests pass including mixed selected-final questions at 390px and zero rehearsal usage impact. Browser preview confirmed no overflow. Physical TV sound/casting/latency remain owner checks.
- GitHub Actions: Azure deploy 36942037370; CI 36942037435; browser tests 36942037531. All in progress at this checkpoint. Do not claim live deployment yet.
- No production data mutations, DNS changes or paid provisioning performed. Prior blockers resolved after environment permissions changed; no previous-policy bypass performed.
- Next action: wait for these workflows, resolve any verified release failure, then run production route/origin smoke and confirm live JS fingerprint and new UI text at ff.adeticket.com. Record deployment evidence and remaining device checks in checkpoints/backlog.

## Release verification restored — 1 October 2026

- Owner authorized deploy again after filesystem/network access changed. Remote main/base is 162dcea; no concurrent remote changes found. Prior session approval and dependency blockers are resolved in this session.
- Verification: 93 Vitest tests plus 7 Node helper tests pass; typecheck/build pass; formatter check passes; dependency audit clean after updating only transitive ip-address 10.7.0 -> 10.7.2. Existing workflow checks remain enabled.
- Browser testing initially reproduced SPA deep-link failures only in hidden local checkout paths. Fixed fallback to sendFile("index.html", {root:web}), preserving hidden-file protection and unknown API 404; regression passes. Updated existing UI selectors for checkbox/sample-rehearsal/readiness controls. 18 Playwright tests pass, including a new 390px selected-birthday rehearsal/readiness flow with no usage recording. Manual browser confirmed preview pool and selected rehearsal; no horizontal overflow at 390px. Hardware audio/casting/phone latency not tested.
- Final tiny order correction: real game now posts the five Fast Money IDs in pack order, matching preview and rehearsal even after mixing. Final typecheck/build/browser rerun passed before publication.
- Additional release files: pnpm-lock.yaml, tests/spa-preview.test.ts, e2e/game.spec.ts and e2e/selected-rehearsal.spec.ts. Formatting normalized checkout CRLF without unrelated content changes.
- No production records changed. Deployment not yet performed at this checkpoint. Next: commit only release files, fast-forward push HEAD to origin/main without force; wait for Azure and CI completion, smoke-check ff.adeticket.com and verify the live JS asset before claiming deployed. No paid resources provisioned.

## Question preview, event readiness and selected Fast Money rehearsal — checkpoint

- Requested improvements 2, 5 and 6 implemented locally in .deploy/ihechi-birthday (content/ihechi-birthday); not deployed. Existing birthday/shared-bank/cap changes preserved.
- Setup preview lists eligible regular pool, reserved Fast Money questions in pack order, and usage exclusions from both banks. It explicitly distinguishes candidate pools from shuffled/required-group play order; viewing never consumes a use.
- Event readiness reuses existing diagnostics and phone stream; checks active approved staged phones for both teams and requires manual display/audio confirmations. Silent events and spoken answers are explicit options. It is advisory, does not issue game commands, and never infers audible sound from a socket. Confirmations reset on game/page changes; audio confirmation resets when sound configuration changes.
- Selected-five rehearsal uses the chosen bank, validates five unique IDs/prompts and attainable 200 points, creates a separate rehearsal and enters Fast Money. Default sample rehearsal retained. Added timer/pass/return/duplicate/reveal coaching. Rehearsal usage remains excluded by existing store queries.
- Changed this phase: apps/web/src/pages/Setup.tsx, components/BuzzerControls.tsx/RehearsalControls.tsx, lib/eventReadiness.ts; apps/server/src/app.ts/rehearsal.ts; tests/rehearsal.test.ts/event-readiness.node.test.mjs; package.json; docs/questions.md/improvement-backlog.md and continuity files.
- Verification: Node selection/readiness regressions 7/7 passed; git diff --check passed. Added selected-five API/factory/privacy regressions but could not run Vitest. pnpm typecheck failed before compilation: installed TypeScript package.json cannot be read (operation not permitted). Full formatting/build/API/browser checks remain pending. No mobile/device/audio verification or deployment claim.
- Publication remains blocked by the recorded GitHub approval-policy refusal; no bypass attempted. No production state, workflows or paid resources changed.
- Usage visible at milestone: five-hour 19% used, weekly 39% used. No reset credit consumed.
- Exact next action: in a session with readable dependencies, format scoped files, run typecheck/full tests/build, verify setup preview and selected rehearsal at phone width, and test live readiness with an audience screen and staged phones. Then use existing owner release authorization in a publication-enabled session; verify GitHub Actions and live ff.adeticket.com before marking released.

## Deployment request — blocked by session approval policy

- Owner authorized deploy and focused improvements. Remote GitHub main verified through read-only connector at 162dcea7b13925e12ed9d1b9d913b2abe42029fa, matching local release base. CLI network cannot connect to GitHub.
- Deployment NOT performed: GitHub create_branch returned "MCP tool call requires approval, but approval policy is never". No remote branch or main mutation occurred. Temporary verification workflow removed locally; no changes to production workflows retained. Do not route around this refusal.
- Further local improvements: Fast Money manual selection now uses accessible checkbox controls instead of Ctrl/Command multi-select for phone usability; added Refresh question history to recover stale counts/API errors. Added Node selection tests to normal pnpm test script. Prior shared-bank, mix and usage-cap work preserved.
- Checks: dependency-free Node selection tests 4/4 pass; git diff --check passes. Typecheck/full Vitest/build remain blocked by unreadable installed dependencies. No rendered verification for new setup UI and no release claim.
- Files additionally changed: apps/web/src/pages/Setup.tsx, package.json. Worktree: .deploy/ihechi-birthday, branch content/ihechi-birthday. Existing root dirty checkout untouched except continuity documents.
- Exact next action: continue in a session permitting repository publication and readable dependencies; format scoped files, run typecheck, full tests/build and a phone-sized local shared-bank/usage-cap game rehearsal. Publish to main only after checks pass, verify Azure workflow and live setup. Owner deployment authorization is already present; no paid resource changes authorized or attempted.

## Shared birthday/Fast Money selection — implementation checkpoint

- Implemented locally in .deploy/ihechi-birthday: opt-in shared regular bank for Fast Money; five final prompts excluded from regular queue by normalized prompt; Mix Fast Money questions rotates a valid attainable set. Existing separate-library mode remains default. At least five regular boards must remain.
- Added excludeAfterUses (1–1000 or unset) to setup, eligible preview and server enforcement using distinct saved-game counts across regular/Fast Money. Current opened regular boards count; Fast Money requires a logged entry. Rehearsals excluded; deleted games/undo remove counts. No permanent usage ledger added. Matching is exact after case/whitespace normalization.
- Files: packages/contracts/src/questionSelection.ts/index.ts, apps/server/src/app.ts, apps/web/src/pages/Setup.tsx, tests/question-selection.node.test.mjs, tests/birthday-bank.test.ts, docs/questions.md. Prior birthday-bank additions preserved.
- Verified: dependency-free Node tests 4/4 passed (threshold boundary, cross-mode distinct games, deleted history, duplicate prompt IDs); git diff --check passed. Typecheck, formatter, Vitest API regression, build and rendered browser verification are BLOCKED: installed dependency files cannot be read under current session permissions (operation not permitted for TypeScript package; Vitest executable unavailable). Offline package reinstall did not repair access. No claim of full verification. API regression for reserved split, server usage enforcement, undersized pool and invalid limits added but not run.
- Deployment: not committed/pushed/deployed; no paid resources changed.
- Exact next action: restore readable development dependencies, run typecheck, birthday-bank API tests + existing schedule/history/server tests and production build; verify shared-bank and usage-limit setup at phone width on a disposable local game. Then obtain release authorization and publish scoped changes. Owner's real games/survey answers were not edited.

## 1 October 2026 — new birthday survey without red-flag question

- Created live regular survey Ihechi's birthday — 29 questions: https://ff.adeticket.com/survey/69d5e8ce093451997556 . Removed only source question 16 (biggest red flag). All other prompts retain their source order and wording. Existing surveys/responses remain unchanged.
- Live management view confirmed collection open and 0 submissions. Respondent browser verified 29 blank answer fields and no red-flag prompt. No suggested answers/scores or test responses added. Screenshot: outputs/naija-feud/docs/evidence/ihechi-birthday-29-survey.png.
- No application code, deployments or paid resources changed. Next action: owner shares this new URL; close/review/export after collection.

## 30 September 2026 — birthday Fast Money survey created live

- Owner requested reusing questions from the 30-question birthday bank. Created a separate Fast Money survey with source questions 1, 2, 12, 21 and 24. Link: https://ff.adeticket.com/survey/6fb8c61b5ea32a135208 . Existing 30-question survey remains open and unchanged.
- Live UI confirmed Fast Money type, five manual prompts, collection open and 0 submissions. Unauthenticated public API confirmed fast-money type, five questions, and prompt/id fields only. No suggested answers or fabricated submissions. Screenshot: outputs/naija-feud/docs/evidence/ihechi-fast-money-survey.png. No app-code changes or deployment in this task.
- Next action: share link, collect responses, close and review grouping before saving Fast Money bank. Use different questions in regular play to avoid revealing these five answers before the final. Distinct-answer/200-point checks remain enforced.

## 30 September 2026 — birthday survey created live

- Created Ihechi's birthday in the existing live Surveys UI, using all 30 regular birthday prompts. Public response URL: https://ff.adeticket.com/survey/7a0c3545aaa500533383 . Collection is open with 0 submissions at creation. No sample responses were added.
- Verified rendered public form has 30 blank answer inputs; supplied game answers/scores are not included. Unauthenticated HTTP GET of public survey succeeds and contains only public question metadata.
- Validated prompt-only survey payload against surveyCreateSchema; files: .deploy/ihechi-birthday/packages/content/data/ihechi-birthday-survey.json and outputs/naija-feud/question-banks/ihechi-birthday-survey-questions.txt. Evidence screenshot: outputs/naija-feud/docs/evidence/ihechi-birthday-survey.png.
- No application code changes, deployments or paid resources in this task. Earlier birthday built-in integration remains local/unpublished.
- Next action: owner shares the respondent URL, then closes collection through Surveys, reviews equivalent wording and saves/exports the collected-survey bank. Questions need at least two answer groups for export.

## 30 September 2026 — Ihechi's birthday question bank

- Completed locally on branch content/ihechi-birthday in .deploy/ihechi-birthday, based on remote main 162dcea. Older dirty game checkout and existing changes were preserved.
- Added 30 regular boards / 153 answers from the owner's birthday Markdown document, retaining six source categories, variable answer counts and supplied scores. Hypothetical survey provenance is explicit.
- Built-in pack ID ihechi-birthday appears in the authenticated pack API and resolves during game creation. Existing games retain their saved questions. No attachment-defined rule or theme changes were applied.
- Questions 26/27 total 170; 28–30 total 200. Values are preserved and source discrepancy recorded in host notes. Existing configured game multipliers still apply. Source Fast Money has only one answer per question and cannot meet the existing distinct-answer format; lightning prompts have no answers. Both excluded, without inventing content.
- Checks: birthday-bank + server tests 7/7 passed; pnpm typecheck and pnpm build passed. Authenticated pack listing/game creation and unrevealed audience answer privacy exercised. No rendered browser or production check performed.
- Main files: packages/content/data/ihechi-birthday.json, packages/content/src/index.ts, apps/server/src/app.ts, tests/birthday-bank.test.ts, docs/questions.md in the worktree. Import-ready copy: outputs/naija-feud/question-banks/ihechi-birthday.json.
- Deployment: not committed, pushed or deployed in this task. JSON can be imported through Question library on the existing site.
- Next action: host imports JSON and chooses Ihechi's birthday in Setup; if built-in release is wanted, obtain deployment authorization and publish the scoped worktree changes. Ask owner for additional Fast Money answers/scores only if a birthday Fast Money pack is requested.
- Usage visible at final milestone: five-hour 94% remaining; weekly 65% remaining.
