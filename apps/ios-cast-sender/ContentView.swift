import SwiftUI

struct ContentView: View {
    @StateObject private var cast = CastManager.shared
    @State private var room = ""

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
                Section { Text(cast.status).font(.footnote).foregroundStyle(.secondary) }
            }
            .navigationTitle("Family Showdown")
        }
    }
}
