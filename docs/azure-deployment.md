# Azure deployment

Source is published to `Caryourday96/adeticket-ff`. The game is live at https://ff.adeticket.com on the `adeticket-ff` Windows Web App in `Kayode_IGO`, Canada Central, using the existing `adeticket` S1 plan. Azure reports the custom domain secured with an SNI managed certificate.

## Prerequisites

The selected Web App uses Node 24 on Windows. The release includes `server.js` and `web.config` for IISNode, with one Node process and support for Azure's named-pipe `PORT`. Linux or local hosting can continue using a numeric port.

Use one application instance. Before enabling deployment, choose and verify durable storage suitable for SQLite, including file locking and backup/restore. Do not put the database under the release directory or an ephemeral temporary directory. If the available storage is unsuitable, implement a managed database adapter first.

## GitHub configuration

CI checks formatting, types, tests, and production build on pushes and pull requests, and uploads the `dist/` release artifact.

The separate Azure workflow deploys automatically on every push to `main`, using the GitHub environment `production`. Manual runs remain available and are restricted to `main`. Formatting, type, test, and build checks must pass before deployment; deployments run one at a time without cancelling an active deployment. Its non-secret Azure identifiers are configured in the workflow's `env` section:

- `AZURE_WEBAPP_NAME`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Managed identity `oidc-msi-b53f` has Website Contributor scoped to `adeticket-ff`. Its federated credential trusts issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`, and subject `repo:Caryourday96@6595450/adeticket-ff@1365306952:environment:production`. This uses GitHub's immutable owner/repository IDs. Do not store a publish profile or long-lived Azure secret in the repository.

The workflow deploys a prebuilt bundle, following [Azure's GitHub Actions guidance](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions). It does not provision resources, configure DNS, or set application secrets.

## App Service configuration

Set application settings securely in Azure:

- `NODE_ENV=production`
- `HOST_PASSWORD`: a private host passphrase.
- `APP_ORIGIN=https://ff.adeticket.com`
- `DATA_DIR=D:\home\data\naija-feud`: outside the deployed release directory. Saved-game restart and backup/restore verification remains required; successful startup alone does not establish storage reliability.

The app reads Azure's `PORT`. Deploy the contents of `dist/`, including `web.config`, `server.js`, `server.cjs`, and the frontend `web/` directory. Windows IISNode starts `server.js`; Linux or local hosting can run `node server.cjs`. No runtime package installation is required; server dependencies are bundled. The IIS WebSocket module is disabled in `web.config` so Node handles the protocol; enable WebSockets in the App Service configuration.

Enable required WebSocket support and appropriate health checking at `/api/health`. Configure HTTPS and the custom domain using the exact verification and CNAME records shown by Azure. Check plan costs and domain/certificate support before changing resources.

## Release verification

Sign in on the host device; create a game; open its QR link on a second device. Reveal an answer and confirm the audience updates. Refresh both screens. Restart the app and verify saved-game recovery. Confirm an unsigned-in client cannot open the private host API or issue commands.

Deployment run `34656556703`, attempt 2, succeeded for commit `08d00a2`. The custom-domain sign-in page loads over HTTPS, `/api/health` returns 200, and unauthenticated `/api/games` and `/api/packs` return 401. Authenticated game rehearsal and restart recovery are tracked in `verification.md`.

## Backup and rollback

For SQLite, stop all app processes before copying the database and any journal files to a protected backup location. Restore while the app is stopped, then start it and verify saved games. Never expose a backup through the public web directory.

Keep the previous verified release artifact. Roll back by deploying it again; keep game data outside the release directory. Schema changes require an explicit migration and backup plan.

## Bible Blitz integration (2026-10-11)

The existing App Service also mounts an independent Bible Blitz Socket.IO server at `/bibleblitz/socket.io`. The package is pinned to host tools release `4f5e094188c9f74f21752c6af29026920cfd169b` from Caryourday96/bible-blitz. Its only production browser origin is https://adeticket.com; the existing Friends Showdown API/socket origin list and host authentication are unchanged. The frontend is served separately at https://adeticket.com/bibleblitz by the existing Static Web App. No new Azure resource or credential is required. Online Bible Blitz rooms are memory-only and expire on restart. Keep the App Service at one process/instance until room coordination supports scale-out.

The shared `/cast` receiver supports both games using separate namespaces. Deploy this receiver before the matching frontend manifest so new Bible Blitz senders reach a compatible receiver. The Bible Blitz static TV document alone permits embedding by this origin. See google-cast.md for protocol and physical-device acceptance details.

Validation: 106 Vitest tests plus 7 Node tests passed; typecheck, build and dependency audit passed. Prettier passed with Windows checkout line endings preserved (`--end-of-line auto`); the existing Linux CI gate validates LF. A new integration test checks both transport paths, CORS isolation and preserved host authentication. Deployment smoke checks now verify the Bible Blitz handshake.

Rollback: revert this integration commit and redeploy using the existing workflow; no database migrations were introduced.

Azure has a pre-existing platform CORS layer, which takes precedence over application CORS. Add `https://adeticket.com` using `az webapp cors add` (preserves the existing legacy origin). This is now an idempotent deployment step. The server continues to reject portfolio-origin writes and handshakes to Friends Showdown endpoints, while allowing the separate Bible Blitz path. The initial release smoke check detected the missing platform entry before multiplayer was marked ready.

The host tools release adds server-authorized plan editing, team branding and public presentation settings. Question plans are included only in authenticated host snapshots and acknowledgements; players and displays keep the public view. Deploy this backend before the matching frontend. Friends Showdown routes, credentials and its original casting namespace are unchanged.
