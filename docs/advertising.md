# Advertising setup

For portal-by-portal instructions, use the [owner's AdSense activation guide](adsense-step-by-step.md). In particular, root-domain approval and root ads.txt must be handled at the hosting for `kayodeadetunji.com`; the game subdomain endpoints alone do not complete that setup.

## Current behaviour

Advertising is off by default. Missing or malformed IDs also disable it. No empty placeholder, ad script or third-party advertising request is created while disabled. Only `/rules` has a manual responsive display placement, separated from the main content. It loads as the placement enters the viewport. Ad blocking or a script failure must not stop gameplay.

Azure runtime settings configure ads without rebuilding the frontend:

| Setting            | Value                                                             |
| ------------------ | ----------------------------------------------------------------- |
| ADS_ENABLED        | `false` until ready; `true` to enable                             |
| ADSENSE_CLIENT     | Public `ca-pub-` ID followed by 16 digits                         |
| ADSENSE_RULES_SLOT | Public 10-digit manual display unit ID                            |
| ADS_CONSENT_READY  | `false` until the approved consent setup is configured and tested |

`ADS_CONSENT_READY` is an operator activation gate, **not a consent manager** and not evidence of an individual visitor's consent.

## Before activation

1. Create an AdSense account and submit the domain for review. Approval is not guaranteed. Use the verification method offered in the account; adding a valid publisher ID makes `/ads.txt` available even with ads off. If Google requests another verification method, implement exactly that method.
2. Create a manual responsive display unit. Keep **Auto ads off** to preserve the route and gameplay exclusions.
3. Configure and publish a Google-certified CMP, such as Google's Privacy & messaging European regulations message, for the relevant site and regions. Include a working way to reopen privacy choices. Test actual consent behaviour and revocation; this code does not implement a home-made consent banner.
4. Review `/privacy` with the actual operator contact, retention practices and advertising settings before going live. It currently contains a basic description, not a complete operator-specific privacy policy.
5. Set the four Azure environment variables. Restart/apply the Web App settings. IDs are public; no advertising credentials belong in the repository.
6. Verify consent presentation with the CMP's regional testing tools, ad delivery, mobile layout, CSP console errors and the exclusions below. Never click your own live ads during testing.

## Verification and rollback

- `/rules`: a single labelled responsive unit, loaded near the viewport; no overlay or forced interaction.
- `/play`, `/play/CODE`, `/audience/CODE`, `/host/CODE`, `/survey/ID`: no AdSense loader or advertising metadata, including direct navigation.
- `/ads.txt`: the configured publisher, `DIRECT`, and Google's certification ID. No dummy publisher when unconfigured.
- Disable with `ADS_ENABLED=false` and restart. Newly loaded pages then make no ad requests.
- Account approval, fill rate, earnings, CMP behaviour and real Google network delivery cannot be verified without the account. Local tests use no live ad impressions.

The rules page uses a fresh nonce and strict dynamic script policy for the application and AdSense loader. Its HTTPS frame/image/connection allowances accommodate Google ad resources; other routes retain the existing tighter policy. HTML with nonces is not cached. Google documents broader optional script permissions; this implementation does not add unsafe-eval. Verify delivery against the approved account before launch if Google's implementation changes.

Sources: [AdSense CSP](https://support.google.com/adsense/answer/16283098), [responsive units](https://support.google.com/adsense/answer/9183460), [certified CMP requirements](https://support.google.com/adsense/answer/13554116).
