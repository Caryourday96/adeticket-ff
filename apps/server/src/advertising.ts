import { randomBytes } from "node:crypto";

export function advertisingConfig(env: NodeJS.ProcessEnv) {
  const publisher = /^ca-pub-\d{16}$/.test(env.ADSENSE_CLIENT ?? "") ? env.ADSENSE_CLIENT! : "";
  const slot = /^\d{10}$/.test(env.ADSENSE_RULES_SLOT ?? "") ? env.ADSENSE_RULES_SLOT! : "";
  return {
    publisher,
    slot,
    enabled:
      env.ADS_ENABLED === "true" && env.ADS_CONSENT_READY === "true" && !!publisher && !!slot,
  };
}

export type AdvertisingConfig = ReturnType<typeof advertisingConfig>;

// Only the public rules document receives third-party advertising privileges.
export function advertisingDocument(html: string, config: AdvertisingConfig) {
  const nonce = randomBytes(24).toString("base64");
  return {
    html: html
      .replace(/<script\b/g, `<script nonce="${nonce}"`)
      .replace(
        "</head>",
        `<meta name="advertising-client" content="${config.publisher}">` +
          `<meta name="advertising-slot" content="${config.slot}"></head>`,
      ),
    csp: `default-src 'self'; script-src 'nonce-${nonce}' 'strict-dynamic' https:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-src https:; form-action 'self'`,
  };
}
