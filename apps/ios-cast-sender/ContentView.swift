import SwiftUI

struct ContentView: View {
    @StateObject private var cast = CastManager.shared
    @StateObject private var appleTV = AppleTVController.shared
    @State private var room = ""
    @State private var pairingCode = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Audience TV") {
                    Button(cast.connectedDevice.isEmpty ? "Choose Google Cast TV" : "Change TV") {
                        cast.presentDevicePicker()
                    }
                    if !cast.connectedDevice.isEmpty { Text(cast.connectedDevice).foregroundStyle(.secondary) }
                }
                Section("Game code") {
                    TextField("ABC123", text: $room)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    Button("Show audience board") { cast.send(room: room) }
                        .disabled(room.isEmpty)
                }
                Section("Apple TV") {
                    if !appleTV.name.isEmpty { Text("Paired: \(appleTV.name)") }
                    TextField("Eight-character code on Apple TV", text: $pairingCode)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    Button("Pair Apple TV") { Task { await appleTV.pair(code: pairingCode) } }
                    Button("Show on Apple TV") { Task { await appleTV.show(room: room) } }
                        .disabled(appleTV.name.isEmpty || room.isEmpty)
                    Text(appleTV.status).font(.footnote).foregroundStyle(.secondary)
                }
                Section { Text(cast.status).font(.footnote).foregroundStyle(.secondary) }
            }
            .navigationTitle("Friends Showdown")
        }
    }
}
