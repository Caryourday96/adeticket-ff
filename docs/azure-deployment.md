# Azure deployment

Source is published to `Caryourday96/adeticket-ff`. The `adeticket-ff` Windows Web App exists in `Kayode_IGO`, Canada Central, on the existing `adeticket` S1 plan. The requested hostname is `naijafeud.kayodeadetunji.com`. Deployment identity, application settings, persistent storage verification, DNS, and TLS still need configuration before the game is live.

## Prerequisites

The selected Web App uses Node 24 on Windows. The release includes `server.js` and `web.config` for IISNode, with one Node process and support for Azure's named-pipe `PORT`. Linux or local hosting can continue using a numeric port.

Use one application instance. Before enabling deployment, choose and verify durable storage suitable for SQLite, including file locking and backup/restore. Do not put the database under the release directory or an ephemeral temporary directory. If the available storage is unsuitable, implement a managed database adapter first.

## GitHub configuration

CI checks formatting, types, tests, and production build on pushes and pull requests, and uploads the `dist/` release artifact.

The separate Azure workflow is manual and disabled unless the repository variable `AZURE_DEPLOY_ENABLED` is set to `true`. Create a GitHub environment named `production` and configure these variables:

- `AZURE_WEBAPP_NAME`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Configure an Entra application or identity with OIDC federation for this repository's `production` environment. Grant only the deployment permissions needed for the target app. Do not store a publish profile or long-lived Azure secret in the repository.

The workflow deploys a prebuilt bundle, following [Azure's GitHub Actions guidance](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions). It does not provision resources, configure DNS, or set application secrets.

## App Service configuration

Set application settings securely in Azure:

- `NODE_ENV=production`
- `HOST_PASSWORD`: a private host passphrase.
- `APP_ORIGIN`: the exact HTTPS subdomain origin, without a trailing slash.
- `DATA_DIR`: the verified absolute persistent data path.

The app reads Azure's `PORT`. Deploy the contents of `dist/`, including `web.config`, `server.js`, `server.cjs`, and the frontend `web/` directory. Windows IISNode starts `server.js`; Linux or local hosting can run `node server.cjs`. No runtime package installation is required; server dependencies are bundled. The IIS WebSocket module is disabled in `web.config` so Node handles the protocol; enable WebSockets in the App Service configuration.

Enable required WebSocket support and appropriate health checking at `/api/health`. Configure HTTPS and the custom domain using the exact verification and CNAME records shown by Azure. Check plan costs and domain/certificate support before changing resources.

## Release verification

Sign in on the host device; create a game; open its QR link on a second device. Reveal an answer and confirm the audience updates. Refresh both screens. Restart the app and verify saved-game recovery. Confirm an unsigned-in client cannot open the private host API or issue commands.

A successful local build is not evidence that cloud storage, DNS, or authentication has been configured.

## Backup and rollback

For SQLite, stop all app processes before copying the database and any journal files to a protected backup location. Restore while the app is stopped, then start it and verify saved games. Never expose a backup through the public web directory.

Keep the previous verified release artifact. Roll back by deploying it again; keep game data outside the release directory. Schema changes require an explicit migration and backup plan.
