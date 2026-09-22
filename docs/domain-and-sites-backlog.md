# Domains, catalogue and advertising

## Approved current work

- [ ] Publish a game catalogue at https://play.adeticket.com using Azure DNS and HTTPS.
- [ ] Initially list Family Showdown and link to https://ff.kayodeadetunji.com. Do not link to the unconfigured ff.adeticket.com.
- [ ] Create a static portfolio at kayodeadetunji.com from the owner's résumé, excluding all work history. Résumé requested; not yet available. Do not invent skills, credentials or projects.
- [ ] Create an Adeticket Inc. static landing site at adeticket.com linking to the catalogue. Public contact: adeticket@gmail.com. Do not imply ticketing or payment services are available.
- [ ] Inspect existing Azure DNS records and hosting before choosing deployment resources. Preserve email records and unrelated subdomains.
- [ ] Publish the public AdSense seller line on both root sites, verify ownership and request review in AdSense. Approval is external and must not be claimed in advance.
- [ ] Finish site-specific privacy disclosures and Google consent configuration, test consent/revocation and CSP, then activate ads only when ready. Keep Auto ads off.

## Deferred by owner

- [ ] Bind ff.adeticket.com to Family Showdown.
- [ ] Redirect old game domains to ff.adeticket.com, preserving paths and query strings.
- [ ] Update generated links and QR codes after the game-domain migration.
- [ ] Update and test Google Cast receiver configuration after the migration.
- [ ] Add additional playable games to the catalogue as they become available.

## Advertising identifiers and current state

Publisher: ca-pub-2467796901387108. Existing game-rules display slot: 8774068970.

Seller line: `google.com, pub-2467796901387108, DIRECT, f08c47fec0942fa0`.

Game ads remain disabled. The European consent builder contains unsaved settings; no message is published. The Azure workflow currently enforces ADS_ENABLED=false and ADS_CONSENT_READY=false. Root hosting is now authorized for separate static sites, superseding the earlier instruction to wait for a hosting destination; it does not authorize replacing the root with the game interface.
