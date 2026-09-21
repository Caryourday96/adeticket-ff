# Monetisation backlog

Requested 21 September 2026. Planning only: no payments, paid access or pricing changes activated.

## Recommended sequence

Keep player/audience joining free. Sell value to the organiser. Test one offer at a time and record actual demand before building recurring billing.

| Priority  | Offer                        | Simplest launch                                           | Work required                                                                                                          |
| --------- | ---------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1         | Hosted game-night service    | Customer books a session; we operate the host controls    | Booking/contact page, hosted payment link, clear event scope and cancellation terms. No customer admin access required |
| 2         | One-event hosting pass       | Organiser pays once to run their own event                | Individual host identity, game ownership, event-bound access and expiry, followed by payment verification              |
| 3         | Sponsor placement            | Sell a fixed event placement to a relevant local business | Logo/name/link controls for lobby, breaks and results; mark sponsorship clearly; sell directly                         |
| 4         | Custom question-pack service | Create an original themed pack for a wedding/company      | Order form, agreed deliverable, manual production/review and delivery                                                  |
| 5         | Optional tip/support link    | Voluntary payment after the event                         | Payment link and unobtrusive results-page link; no gated gameplay                                                      |
| 6         | Recurring host membership    | Subscription for repeat MCs and organisers                | Build only after repeat demand; account isolation, billing portal, renewals, cancellation and entitlement enforcement  |
| Secondary | AdSense                      | One manual placement below public How to play content     | Existing integration is off; account/domain approval, root ads.txt, CMP, privacy details and activation testing remain |

“Easy” refers to implementation, not guaranteed sales. Sponsored placements still require finding a sponsor. A paid hosted service uses our time for each event. Ads depend on eligible traffic and fill; the current rules-page-only placement has limited exposure.

## Hosting-access pilot

- [ ] Decide offer: one game or one event window (suggest a 24-hour activation window; do not implement until agreed).
- [ ] Test CA$10–20 per event, with CA$15 as a possible first experiment. These are hypotheses, not validated prices. Keep currency explicit.
- [ ] Add individual organiser accounts and enforce ownership on every host game, pack and survey endpoint. The present shared host password must remain private; do not sell or distribute it.
- [ ] Store an expiring entitlement tied to the organiser and event. Scope any redeemable invitation to that organiser/event; protect against reuse.
- [ ] Begin with manual fulfilment: verify a completed payment in the provider dashboard, then grant event access. A receipt screenshot or checkout return URL is not payment verification.
- [ ] Automate later with signed, idempotent payment webhooks; handle refunds, duplicate events and failed payments.
- [ ] Define what expiry does. Do not interrupt a paid event mid-round; decide an explicit completion/grace policy.
- [ ] Publish support contact, included features, cancellation/refund terms and clear total pricing before sales.
- [ ] Test host A cannot see/edit/delete host B's games, packs or surveys; players still join free.

Stripe Payment Links can provide a hosted checkout without building payment forms. Confirm provider availability for the operator's business country and payout account before selecting it; this proposal assumes neither an existing account nor a specific fee. [Official Payment Links overview](https://stripe.com/payments/payment-links).

## Measure before expanding

Track enquiries, paid events, repeat hosts, support time, refunds and net revenue after payment/hosting costs. Example arithmetic only: 20 passes × CA$15 = CA$300 gross. A future CA$25–40/month membership is another test range, not a commitment.

Use original/survey-collected question packs for commercial offers; do not assume TV-extracted footage, artwork or packs are licensed for sale. Original product branding and content review belong in commercial launch preparation.

## Advertising activation backlog

- [ ] Follow [the owner activation guide](adsense-step-by-step.md).
- [ ] Approved AdSense/root domain, public publisher ID and manual slot ID.
- [ ] Verify root-domain hosting and ads.txt delegation for both game subdomains.
- [ ] Finish operator privacy/contact information and certified CMP integration, including privacy-choice reopening.
- [ ] Test accepted/refused consent and blocked/no-fill ads before activating production.
- [ ] Keep Auto ads off and all join/buzzer/live/host/survey routes ad-free.
