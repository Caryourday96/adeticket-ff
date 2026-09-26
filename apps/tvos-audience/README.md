# Apple TV audience receiver (first pass)

This is a native tvOS screen for the public Friends Showdown audience state. It does not mirror the iPad: the Apple TV connects independently to `https://ff.adeticket.com` and refreshes the board once per second. The host remains in control on the web dashboard. The first pass displays teams, scores, regular answers, Fast Money entries and the winner; it does not yet reproduce the web board's theme, sound effects or timer.

## Try it on an Apple TV

1. On a Mac, create a new Xcode **tvOS App** project named `FriendsShowdownTV` with SwiftUI.
2. Replace the generated app and content files with `AudienceTVApp.swift` and `AudienceTVView.swift`. Confirm both are in the tvOS target.
3. Use a unique bundle identifier and select your Apple Account's Personal Team in Signing & Capabilities. Pair the Apple TV with Xcode and run the app.
4. Enter the six-character game code from the host. The board updates without a sender app.

No CocoaPods, Cast SDK or new server resource is required for this receiver. Apple Personal Team provisioning expires periodically, so this is for personal testing rather than App Store distribution. The code has not been compiled or tested on Apple TV from the Windows development workspace.

## Other TVs

- TVs with Google Cast built in can use the existing iPad Cast sender and Cast receiver.
- A TV with a web browser can open `https://ff.adeticket.com/audience/<GAME_CODE>` directly.
- An Apple TV needs this native tvOS receiver for an independent board. AirPlay screen mirroring is a separate fallback, not equivalent to independent casting.
- Smart TVs without Google Cast or a browser need a platform-specific receiver app or an external Cast/Apple TV device; no universal TV discovery protocol can install the game on them.

## Icon

The owner supplied `../ios-cast-sender/artwork/owner-icon-source.jpg`. Keep this original unmodified. Export an appropriately sized PNG for Xcode's tvOS App Icon & Top Shelf Image asset catalog; tvOS uses layered icon assets, so the owner should review the resulting focus effect on an Apple TV before treating it as final. Do not substitute generated artwork that changes the mark.
