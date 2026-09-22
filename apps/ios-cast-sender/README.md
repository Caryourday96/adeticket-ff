# Family Showdown iPad Cast sender

This is a small native iOS sender for the existing Google Cast receiver. It is intended for free Personal Team testing on one iPad. It does not replace the web host dashboard and it does not require a new receiver.

## Setup on a Mac

1. Install Xcode and create a new iOS **App** project named `FamilyShowdownCast` using SwiftUI.
2. Copy `CastManager.swift` and `ContentView.swift` into the project.
3. Add the CocoaPods dependency from `Podfile` and run `pod install`.
4. Open the generated `.xcworkspace`, set the bundle identifier to a unique value, and select your Apple Account under Signing & Capabilities. Select the free **Personal Team**.
5. Set the deployment target to iOS 16 or later. Add the local-network and Bonjour entries from `Info.plist.example`.
6. Run on the iPad. Enable Developer Mode if Xcode asks, and keep the iPad and Cast TV on the same Wi-Fi.
7. Enter the six-character host game code and tap Cast. The app sends `SHOW_ROOM` to the receiver at `/cast` using Cast application ID `0AF8BA4D`.

The free Personal Team is for personal device testing. The app must be re-provisioned periodically and cannot be distributed through the App Store or TestFlight without paid Apple Developer membership.

## Receiver contract

The receiver is the existing HTTPS page at `https://ff.adeticket.com/cast`. The sender sends the existing custom namespace `urn:x-cast:com.naijafeud.audience` and message `{ "type": "SHOW_ROOM", "room": "ABC123" }`.
