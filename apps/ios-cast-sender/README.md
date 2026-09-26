# Friends Showdown iPad Cast sender

This is a small native iOS sender for the existing Google Cast receiver. It is intended for free Personal Team testing on one iPad. It does not replace the web host dashboard and it does not require a new receiver.

## Setup on a Mac

1. Install Xcode and create a new iOS **App** project named `FamilyShowdownCast` using SwiftUI.
2. Copy `CastManager.swift`, `AppleTVController.swift` and `ContentView.swift` into the project. Confirm all three belong to the iOS app target.
3. Add the CocoaPods dependency from `Podfile` and run `pod install`.
4. Open the generated `.xcworkspace`, set the bundle identifier to a unique value, and select your Apple Account under Signing & Capabilities. Select the free **Personal Team**.
5. Set the deployment target to iOS 16 or later. Add the local-network and Bonjour entries from `Info.plist.example`.
6. Run on the iPad. Enable Developer Mode if Xcode asks, and keep the iPad and Cast TV on the same Wi-Fi.
7. Enter the six-character host game code and tap Cast. The app sends `SHOW_ROOM` to the receiver at `/cast` using Cast application ID `0AF8BA4D`.

## Show a game on Apple TV

Install and open the separate tvOS audience app from `../tvos-audience/` first. When its eight-character pairing code appears, enter that code in the iPad app's **Apple TV** section and tap **Pair Apple TV**. Enter the host's six-character game code in the iPad app and tap **Show on Apple TV**. The pairing credential is stored in the iPad Keychain; after pairing, the TV can be selected again without typing its pairing code. The TV renders independently and the iPad remains free for hosting. This path requires the server's `/api/tv/*` endpoints to be deployed; it is not available on the current production server until that release occurs.

The supplied `artwork/owner-icon-source.jpg` is the owner's exact logo. In Xcode, open `Assets.xcassets` → `AppIcon`, choose the single-size icon layout, and use a 1024×1024 PNG export of this source. Keep the mark and signature unchanged. The uploaded source is 700×700 JPEG, so it is preserved here as artwork rather than incorrectly labelled as a ready-to-build app icon. The generated image variant was rejected because it altered the logo's proportions.

For an Apple TV with an independent board, see `../tvos-audience/README.md`. A Cast-enabled smart TV works with this sender; a TV browser can open the audience URL directly. Other smart TVs need their own receiver app or an external Cast/Apple TV device.

The free Personal Team is for personal device testing. The app must be re-provisioned periodically and cannot be distributed through the App Store or TestFlight without paid Apple Developer membership.

## Receiver contract

The receiver is the existing HTTPS page at `https://ff.adeticket.com/cast`. The sender sends the existing custom namespace `urn:x-cast:com.naijafeud.audience` and message `{ "type": "SHOW_ROOM", "room": "ABC123" }`.
