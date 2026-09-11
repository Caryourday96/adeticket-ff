# Naija Family Showdown

A host-led Nigerian-themed game with a private control desk and a synchronized audience board. Built with React, TypeScript, Express, Socket.IO, and SQLite.

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

**No repository, Azure resource, or subdomain has been configured or deployed.** Deployment settings remain empty at the user's request. The Azure workflow is manual and skips deployment unless `AZURE_DEPLOY_ENABLED=true` is configured.

See [Azure setup](docs/azure-deployment.md), [architecture](docs/architecture.md), [question editing](docs/questions.md), and [host guide](docs/host-guide.md).
