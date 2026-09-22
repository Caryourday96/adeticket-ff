import Foundation
import GoogleCast

@MainActor
final class CastManager: NSObject, ObservableObject, GCKSessionManagerListener {
    static let shared = CastManager()
    static let appID = "0AF8BA4D"
    static let namespace = "urn:x-cast:com.naijafeud.audience"

    @Published private(set) var connectedDevice = ""
    @Published private(set) var status = "Choose a TV, then enter a game code."

    private override init() {
        super.init()
        let options = GCKCastOptions(receiverApplicationID: Self.appID)
        GCKCastContext.setSharedInstanceWith(options)
        GCKCastContext.sharedInstance().sessionManager.add(self)
    }

    func presentDevicePicker() {
        GCKCastContext.sharedInstance().presentCastDialog()
    }

    func send(room: String) {
        let code = room.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard code.range(of: "^[A-F0-9]{6}$", options: .regularExpression) != nil else {
            status = "Enter a six-character game code."
            return
        }
        guard let session = GCKCastContext.sharedInstance().sessionManager.currentCastSession else {
            status = "Choose a Google Cast TV first."
            return
        }
        do {
            try session.sendMessage(["type": "SHOW_ROOM", "room": code],
                                    namespace: Self.namespace)
            status = "Audience room \(code) sent to \(connectedDevice)."
        } catch {
            status = "The room could not be sent. Reconnect to the TV and try again."
        }
    }

    func sessionManager(_ sessionManager: GCKSessionManager, didStart session: GCKCastSession) {
        connectedDevice = session.device.friendlyName ?? "Google Cast TV"
        status = "Connected to \(connectedDevice)."
    }

    func sessionManager(_ sessionManager: GCKSessionManager, didEnd session: GCKCastSession, withError error: Error?) {
        connectedDevice = ""
        status = "Casting stopped."
    }

    func sessionManager(_ sessionManager: GCKSessionManager, didFailToStart session: GCKCastSession, withError error: Error) {
        connectedDevice = ""
        status = "Could not connect to the TV. Check Wi-Fi and the registered Cast device."
    }
}
