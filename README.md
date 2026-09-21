# Naija Family Showdown

A host-led Nigerian-themed game with a private control desk and a synchronized audience board. Built with React, TypeScript, Express, Socket.IO, and SQLite.

## Player registration and stage controls

In setup, leave **Players enter their own names** selected and enter the two team
names. Create the game and share `/play` plus the six-character game code, or use
the direct player QR link in **Phone buzzers → Invite phones**. `/join` remains the
audience-only entry page.

Players enter the code, select a team and type their name. They need no host
password. The host approves each registration in **Phone buzzers**, then clicks
**Put [name] on stage** for one player per team. Approval alone does not enable
self-registered phones. Read the question and click **Open buzzers**. Only the
selected face-off players can buzz; the server enforces eligibility and accepts
the first valid request. Changing the stage or roster locks buzzers again.

**Take [name] off stage** keeps the phone registered. **Remove [name]** revokes its
registration; the player can join again. Team names come from the saved game,
including after phone refreshes and host renames. Existing games with host-entered
rosters still work; players can type an existing roster name to request that place.
Duplicate phone registrations for a name are rejected. Teams support up to 12
members. Stage changes are available before a face-off starts.

## Survey collection

Use **Surveys** to share preset or custom questions, collect responses, review
equivalent answers and export a collected-survey question bank. The public form
needs no host login. See [the survey guide](docs/surveys.md) for scoring, sample
sizes, grouping and duplicate-submission limits.

## Question libraries

The library has separate **Regular rounds** and **Fast Money** tabs. Packs carry
`roundType: "regular"` or `roundType: "fast-money"`; older packs without that field
remain regular-round packs. JSON and CSV imports let the host review the library
classification before saving. CSV exports include a `round_type` column.

Game setup selects the regular pack and Fast Money pack independently. Select
exactly five distinct Fast Money questions; the server checks that the selection
can reach 200 points. The built-in Fast Money pack is the default. Games retain
their own question snapshots when a library is later edited.

The Python scraper can export `naija_game_pack.json` for libraries containing at
least five verified, compatible questions. Import this file through the library;
the scraper's detailed research JSON is a separate evidence format.

## Run locally

Use Node.js 24 (minimum 22.13) and pnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Open **http://localhost:3000**. In local development, the host can enter without a passphrase unless one is configured. Create a game, then click **Audience screen** to open its board or share the QR code.

For configuration, copy `.env.example` to `.env`. Set `HOST_PASSWORD` to protect host access. Never commit `.env`. All users with this passphrase share the same trusted-host access; this is not a multi-tenant account system.

For development with live reload, use two terminals:

```sh
pnpm dev
pnpm dev:web
```

Visit http://localhost:5173 for the development interface. The web server proxies API and Socket.IO requests to port 3000.

## Join from another device

The QR code opens `/audience/ROOMCODE` on the **same origin used by the host**. A localhost QR only works on the host computer.

For a local network:

1. Set `APP_ORIGIN` to the computer's reachable LAN URL, such as `http://192.168.1.20:3000`.
2. Set a host passphrase, build, and start the server.
3. Open that LAN URL in the host browser before displaying the QR code.
4. Keep devices on the same reachable network. Any firewall change is managed by the computer owner.

HTTPS deployment is the preferred way to use phones reliably. Audience viewing does not require a login. Anyone with a room code can see that game's public board. Host commands require a valid HttpOnly session.

## Folder structure

```text
naija-feud/
├── apps/
│   ├── web/
│   │   ├── index.html
│   │   └── src/
│   │       ├── components/     # Board, branding, rosters, Fast Money
│   │       ├── hooks/          # Connection and game-state lifecycle
│   │       ├── lib/            # API, downloads, CSV conversion
│   │       ├── pages/          # Setup, host, audience, question library
│   │       ├── App.tsx         # Routes and host gate
│   │       └── styles.css
│   └── server/src/
│       ├── index.ts            # Startup and configuration
│       ├── app.ts              # HTTP, authentication, live connections
│       └── store.ts            # SQLite, sessions, history, undo
├── packages/
│   ├── contracts/src/          # Shared schemas, commands and types
│   ├── game/src/               # Pure rules and audience projection
│   └── content/
│       ├── data/               # Editable JSON question banks
│       └── src/                # Seed loading and validation
├── tests/                      # Rules, API, sockets and recovery tests
├── scripts/                    # Build and local web development
├── docs/                       # Architecture, content, deployment
├── .github/workflows/          # CI and opt-in Azure deployment
├── .data/                      # Local runtime data; ignored by Git
└── dist/                       # Generated release; ignored by Git
```

## Included

- Two named teams with editable members, captains, order, and active-player correction.
- Face-offs, play/pass, cumulative strikes, steals, round multipliers, sudden death, and undo.
- Fast Money with two players, 20/25-second clocks, passing, duplicate checks, and score reveals.
- Host dashboard, audience preview, audience-only route, QR code, and room-code entry.
- Server-authoritative scoring and persisted snapshots; reconnecting clients recover current state.
- 24 starter main-round boards, including six music boards; one dedicated five-question Fast Money set.
- Private question editor, JSON/CSV import preview, and exports. Edits create new packs.
- Optional host audio cues, fullscreen audience mode, keyboard controls, and reduced-motion styling.
- Bundled fonts and assets: no external font or image requests are needed during play.

All bundled point values are **illustrative**, not real survey results. The design is an original TV-style approximation; exact Nigerian-show visuals and edition-specific rules remain unverified.

## Checks

```sh
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Use `pnpm format` after edits. Keep business rules in `packages/game` and add a regression test when changing scoring or phase transitions.

## Deployment status

The game is deployed at **https://naijafeud.kayodeadetunji.com** on the `adeticket-ff` Windows Azure Web App in Canada Central. Source is in `Caryourday96/adeticket-ff`.

Every push to `main` automatically deploys to Azure after formatting, type, test, and build checks pass. Other branches and pull requests run validation without deploying. Manual deployment is also available: GitHub Actions → Deploy to Azure → Run workflow → `main`. Deployments use OIDC; no Azure password or publish profile is stored in Git.

See [Azure setup](docs/azure-deployment.md), [architecture](docs/architecture.md), [question editing](docs/questions.md), and [host guide](docs/host-guide.md).
