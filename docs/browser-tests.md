# Browser tests

In GitHub, open **Actions → Playwright browser tests → Run workflow** and select your branch.
The same suite runs automatically on pushes to main and pull requests. Download the
`playwright-report` artifact after a run for the HTML report and failure traces/screenshots.

Tests build the app and start a disposable local server on the runner. They never
connect to the live Azure game or require its credentials. The password in the test
configuration is a public fixture used only by that isolated server.

Locally run `pnpm exec playwright install chromium`, `pnpm build`, then
`pnpm test:e2e`. Port 3107 must be free. Each run uses a separate database under
`.data/`. Unit tests remain available with `pnpm test`.

The initial Chromium suite covers rejected host sign-in, rehearsal creation,
simulated buzzer delivery to an independent audience, and Fast Money timer/question
navigation. Real phone network latency and physical audio output are not covered.
This workflow reports independently; it is not yet a deployment gate.
