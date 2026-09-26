import SwiftUI
import Combine

private struct Team: Decodable { let name: String }
private struct Answer: Decodable, Identifiable {
    let id: String
    let rank: Int
    let revealed: Bool
    let text: String?
    let points: Int?
}
private struct Question: Decodable {
    let prompt: String
    let answers: [Answer]
}
private struct FastEntry: Decodable { let text: String; let points: Int }
private struct FastRound: Decodable {
    let prompts: [String]
    let entries: [[FastEntry?]]
}
private struct AudienceState: Decodable {
    let revision: Int
    let round: Int
    let phase: String
    let teams: [Team]
    let scores: [Int]
    let question: Question
    let fast: FastRound?
    let message: String
    let paused: Bool
    let winner: Int?
}

@MainActor
private final class AudienceFeed: ObservableObject {
    @Published var state: AudienceState?
    @Published var status = "Enter the game code shown by the host."
    @Published var pairingCode = ""
    @Published var paired = false
    private var polling: Task<Void, Never>?
    private var pairing: Task<Void, Never>?
    private var activeRoom = ""

    func startPairing() {
        guard pairing == nil else { return }
        let defaults = UserDefaults.standard
        let id = defaults.string(forKey: "tvDeviceId") ?? UUID().uuidString.lowercased()
        let secret = defaults.string(forKey: "tvDeviceSecret") ??
            (UUID().uuidString + UUID().uuidString).replacingOccurrences(of: "-", with: "").lowercased()
        defaults.set(id, forKey: "tvDeviceId")
        defaults.set(secret, forKey: "tvDeviceSecret")
        pairing = Task {
            var lastRegistration = Date.distantPast
            while !Task.isCancelled {
                do {
                    if !paired && Date().timeIntervalSince(lastRegistration) > 240 {
                        let response: RegisterReply = try await post("register", body: [
                            "deviceId": id, "deviceSecret": secret, "name": "Friends Showdown Apple TV"])
                        pairingCode = response.pairingCode ?? ""
                        paired = response.paired
                        lastRegistration = Date()
                    }
                    let response: PollReply = try await post("poll", body: [
                        "deviceId": id, "deviceSecret": secret])
                    pairingCode = response.pairingCode ?? ""
                    paired = response.paired
                    if let room = response.room, room != activeRoom {
                        activeRoom = room
                        start(code: room)
                    }
                } catch {
                    status = "Apple TV connection lost. Retrying…"
                }
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    func requestNewPairingCode() {
        guard let id = UserDefaults.standard.string(forKey: "tvDeviceId"),
              let secret = UserDefaults.standard.string(forKey: "tvDeviceSecret") else { return }
        Task {
            do {
                let response: RegisterReply = try await post("register", body: [
                    "deviceId": id, "deviceSecret": secret,
                    "name": "Friends Showdown Apple TV", "renew": true])
                pairingCode = response.pairingCode ?? ""
            } catch { status = "Could not generate a pairing code. Try again." }
        }
    }

    private struct RegisterReply: Decodable { let pairingCode: String?; let paired: Bool }
    private struct PollReply: Decodable { let pairingCode: String?; let paired: Bool; let room: String? }
    private func post<T: Decodable>(_ action: String, body: [String: Any]) async throws -> T {
        var request = URLRequest(url: URL(string: "https://ff.adeticket.com/api/tv/\(action)")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse, response.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    func start(code: String) {
        stop()
        let room = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard room.range(of: "^[A-F0-9]{6}$", options: .regularExpression) != nil else {
            status = "Enter the six-character game code."
            return
        }
        status = "Connecting to \(room)…"
        polling = Task {
            while !Task.isCancelled {
                do {
                    var request = URLRequest(url: URL(string: "https://ff.adeticket.com/api/games/\(room)/audience")!)
                    request.cachePolicy = .reloadIgnoringLocalCacheData
                    request.timeoutInterval = 8
                    let (data, response) = try await URLSession.shared.data(for: request)
                    guard let response = response as? HTTPURLResponse, response.statusCode == 200 else {
                        state = nil
                        status = "Game not found. Check the code with the host."
                        break
                    }
                    let latest = try JSONDecoder().decode(AudienceState.self, from: data)
                    if state == nil || latest.revision >= state!.revision { state = latest }
                    status = "LIVE · \(room)"
                } catch {
                    status = "Connection lost. Retrying…"
                }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
        }
    }

    func stop() { polling?.cancel(); polling = nil; pairing?.cancel(); pairing = nil }
}

struct AudienceTVView: View {
    @AppStorage("audienceRoom") private var room = ""
    @StateObject private var feed = AudienceFeed()

    var body: some View {
        VStack(spacing: 24) {
            HStack {
                Text("FRIENDS SHOWDOWN").font(.title.bold())
                Spacer()
                Text(feed.status).font(.headline).foregroundStyle(.secondary)
            }
            if !feed.pairingCode.isEmpty {
                Text("Pair from iPad with code \(feed.pairingCode)")
                    .font(.title3.bold())
            } else if feed.paired {
                Text("Apple TV paired with iPad").font(.title3)
                Button("Pair another iPad") { feed.requestNewPairingCode() }
            }
            if let game = feed.state {
                HStack {
                    Text(game.fast == nil ? "ROUND \(game.round + 1)" : "FAST MONEY")
                    Spacer()
                    if game.paused { Text("PAUSED") }
                }.font(.title2.bold())
                if let winner = game.winner, (game.phase == "finished" || game.phase == "champion"),
                   game.teams.indices.contains(winner) {
                    Text("WINNER · \(game.teams[winner].name)").font(.largeTitle.bold())
                } else if let fast = game.fast {
                    ForEach(fast.prompts.indices, id: \.self) { index in
                        HStack {
                            Text(fast.prompts[index]).lineLimit(2)
                            Spacer()
                            ForEach(fast.entries.indices, id: \.self) { player in
                                if fast.entries[player].indices.contains(index),
                                   let entry = fast.entries[player][index] {
                                    Text("\(entry.text) · \(entry.points)")
                                }
                            }
                        }.font(.title3)
                    }
                } else {
                    Text(game.question.prompt).font(.largeTitle.bold()).multilineTextAlignment(.center)
                    LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 16) {
                        ForEach(game.question.answers) { answer in
                            HStack {
                                Text(answer.revealed ? (answer.text ?? "") : "\(answer.rank)")
                                Spacer()
                                if answer.revealed { Text("\(answer.points ?? 0)") }
                            }
                            .font(.title2.bold()).padding(20)
                            .background(.blue.gradient, in: RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                HStack(spacing: 40) {
                    ForEach(game.teams.indices, id: \.self) { index in
                        Text("\(game.teams[index].name)  \(game.scores.indices.contains(index) ? game.scores[index] : 0)")
                            .font(.title.bold())
                    }
                }
                Text(game.message).font(.title3).lineLimit(2)
            } else {
                Text("Audience screen").font(.largeTitle.bold())
                Text("The host controls the game. Enter its code to show the live board here.")
                    .font(.title3).foregroundStyle(.secondary)
            }
            HStack {
                TextField("Six-character game code", text: $room)
                    .frame(width: 400)
                Button("Show game") { feed.start(code: room) }
            }
        }
        .padding(60)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.03, green: 0.07, blue: 0.2))
        .foregroundStyle(.white)
        .onAppear { feed.startPairing(); if !room.isEmpty { feed.start(code: room) } }
        .onDisappear { feed.stop() }
    }
}
