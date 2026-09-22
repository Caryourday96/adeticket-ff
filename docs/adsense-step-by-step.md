# Enable advertising on this game: owner guide

Verified against Google documentation on 21 September 2026. The code is deployed but ads are **off**. Completing an AdSense account does not automatically make the site eligible or activate ads. The current placement is only below the content at `/rules`.

## 1. Create the account

Open https://adsense.google.com/start/ and sign in with the Google account that should own advertising revenue. Complete the requested account, business/address and payment information accurately. Follow any identity/payment verification tasks in your account. No Google password, bank details or credentials need to be sent in chat.

## 2. Add the root domain

In **Sites → New site** (or Add site), enter the root site you want reviewed. The game now uses `ff.adeticket.com` and the catalogue uses `play.adeticket.com`; manage those under the Adeticket domain rather than the personal portfolio domain. Follow the site verification method Google offers, then request review.

We must check where the root domain is hosted before placing its verification file/meta tag. The Azure game app controls the two game subdomains; we have not established that it serves the root domain. Do not change the root DNS or replace another site just for verification. If using a meta tag or another offered method, add it to the actual root site's hosting.

Google may require improvements to accessible original content before approval. The game homepage is a host login; we should prepare a useful public product page, instructions, contact and privacy information if needed. Never expose the host dashboard or private game answers for review. Wait for the site status to become **Ready**; approval is not guaranteed.

Sources: [Connect your site](https://support.google.com/adsense/answer/7584263), [site/subdomain management](https://support.google.com/adsense/answer/12170421).

## 3. Get your publisher ID and configure it in Azure

Find the public publisher ID in **Account → Settings → Account information**. It looks like `pub-` followed by 16 digits. The game setting uses the prefix `ca-pub-` with those same digits; copying `data-ad-client` from Google's ad code also gives the required value.

In Azure Portal:

1. Open **Resource groups → Kayode_IGO → adeticket-ff** (the App Service).
2. Open **Settings → Environment variables → App settings**.
3. Add or edit `ADSENSE_CLIENT` with your real `ca-pub-…` value.
4. Set `ADS_ENABLED=false` and `ADS_CONSENT_READY=false`.
5. Click **Apply/Save** and confirm the restart if shown. Setting labels can differ slightly in the portal.

Publisher/slot IDs are public identifiers. They may be shared for setup; keep login credentials private.

## 4. Publish ads.txt at the root and verify the subdomains

With the publisher ID configured, the app serves:

- https://ff.adeticket.com/ads.txt
- https://play.adeticket.com/ads.txt

Each should contain the real seller line:

```text
google.com, pub-YOUR_16_DIGIT_ID, DIRECT, f08c47fec0942fa0
```

The placeholder above must be replaced with your actual publisher ID. At the hosting service for **https://kayodeadetunji.com/ads.txt**, preserve existing authorised sellers and add your Google seller line. To explicitly delegate these subdomain files, also add:

```text
subdomain=ff.adeticket.com
subdomain=play.adeticket.com
```

Confirm all three URLs return plain text, not an HTML fallback or login page. Publishing subdomain files alone does not finish root-domain setup. Use AdSense's ads.txt check/status and allow its crawler to refresh. [Google ads.txt FAQ](https://support.google.com/adsense/answer/9785052).

## 5. Create the manual display ad

In AdSense, open **Ads → By ad unit → Display ads**. Name it `Game rules footer`, select **Responsive**, then **Create**. In the generated code, copy:

- `data-ad-client`: the `ca-pub-…` ID.
- `data-ad-slot`: the numeric slot ID (the current app validates 10 digits).

Back in the same Azure App settings page, set `ADSENSE_RULES_SLOT` to that slot ID and Apply. Leave both enable/readiness flags false. You do not need to paste the full ad script into the app. If the actual slot format differs from validation, update the validator rather than altering Google's ID.

Keep **Auto ads off** for the site. We use one manual unit and do not want Google placing overlays or ads by buzzers. [Google display-unit instructions](https://support.google.com/adsense/answer/9274025).

## 6. Configure consent and complete privacy information

In AdSense open **Privacy & messaging → European regulations → Create message** (or manage the automatically created message). Select the applicable site, supply the site's name and actual privacy-policy URL, configure the message and publish it. Google's CMP is one certified option for EEA, UK and Swiss visitors. Review other regional messages applicable to your audience in the same area.

Use `https://ff.adeticket.com/privacy` as the game privacy URL after completing its operator/contact, retention and actual advertising details. The page now includes the confirmed operator, Adeticket Inc., and contact adeticket@gmail.com. Privacy-choice reopening is prepared; a live CMP and its behaviour still need verification.

**Remaining developer work before activation:** verify that the published CMP loads with this app's manual/lazy ad loader, provides a working way to reopen privacy choices, and respects consent acceptance/refusal/revocation. Run the checks in a controlled test deployment with the real account and Google's testing tools. Publishing a message alone is not proof this integration works. `ADS_CONSENT_READY` is only a configuration gate; it does not collect visitor consent.

Sources: [Create a message](https://support.google.com/adsense/answer/10960768), [Privacy & messaging testing](https://support.google.com/adsense/answer/10924669), [certified CMP requirements](https://support.google.com/adsense/answer/13554116).

## 7. Enable only after approval and testing

Once the site is Ready, ads.txt is correct, privacy details are complete, and CMP/ad-delivery tests pass, set these in **adeticket-ff → Environment variables → App settings**:

| Name               | Value                       |
| ------------------ | --------------------------- |
| ADSENSE_CLIENT     | Your actual `ca-pub-…` ID   |
| ADSENSE_RULES_SLOT | Your actual display slot ID |
| ADS_CONSENT_READY  | `true`                      |
| ADS_ENABLED        | `true`                      |

Apply/Save. This restarts/reloads the app; schedule it outside an active game. No GitHub code deployment is needed for these environment changes. Both game subdomains use the same App Service settings.

## 8. Verify the result

Visit https://ff.adeticket.com/rules and scroll below the instructions. The ad request loads as the placement enters view. Check the catalogue domain too. Ads may not fill immediately, and ad blockers can prevent display. Use AdSense diagnostics; do not click your own ads to test.

Confirm no ads or AdSense loader on `/play`, player buzzers, host controls, audience boards or survey pages. Check phone layout, consent choices and browser console/CSP errors. Our disabled-state tests pass; live ad delivery has not yet been tested because no account IDs have been supplied.

## 9. Turn ads off if needed

Set `ADS_ENABLED=false` in Azure and Apply. New page loads stop loading the ad code. No need to remove the publisher ID or ads.txt. Existing open pages should be reloaded.

## What to do first

Create the account, add the root domain, and obtain the publisher ID. Then establish access to the root site's hosting for verification/ads.txt. Do not turn either activation flag on yet. We can complete account-specific consent integration and verification once those details are available.

## Setup checkpoint — 22 September 2026

AdSense sign-in has been opened for the owner. Ads remain disabled pending review. The game is now served from `ff.adeticket.com`; the personal portfolio remains at `kayodeadetunji.com` and the catalogue at `play.adeticket.com`.

Account setup: publisher `ca-pub-2467796901387108`; responsive unit **Family Showdown - Game rules footer**, slot `8774068970`. The deployment workflow sets these public IDs and keeps both activation flags false. Change the workflow when activating; portal-only settings will be overwritten on deployment. Auto ads were confirmed OFF. Root hosting is reserved for the owner's personal/business site; await those hosting details, do not point the root to the game. Site status is Requires review; ownership not yet verified.
