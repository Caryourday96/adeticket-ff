import Foundation
import Combine
import Security

@MainActor
final class AppleTVController: ObservableObject {
    static let shared = AppleTVController()
    @Published private(set) var name = ""
    @Published private(set) var status = "Pair once using the code on your Apple TV."
    private let service = "com.adeticket.friends-showdown.tv"
    private let account = "paired-tv"
    private struct Pairing: Codable { let deviceId: String; let deviceName: String; let controllerToken: String }
    private var pairing: Pairing?

    private init() {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: service, kSecAttrAccount as String: account,
                                    kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
           let data = result as? Data,
           let saved = try? JSONDecoder().decode(Pairing.self, from: data) {
            pairing = saved
            name = saved.deviceName
        }
    }

    func pair(code: String) async {
        let code = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard code.range(of: "^[A-F0-9]{8}$", options: .regularExpression) != nil else {
            status = "Enter the eight-character code shown on Apple TV."
            return
        }
        do {
            let saved: Pairing = try await post("pair", body: ["pairingCode": code])
            let data = try JSONEncoder().encode(saved)
            let key: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                      kSecAttrService as String: service, kSecAttrAccount as String: account]
            SecItemDelete(key as CFDictionary)
            var newKey = key
            newKey[kSecValueData as String] = data
            newKey[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(newKey as CFDictionary, nil) == errSecSuccess else {
                status = "Could not save Apple TV pairing on this iPad."
                return
            }
            pairing = saved
            name = saved.deviceName
            status = "Paired with \(name)."
        } catch {
            status = "Pairing failed. Check the TV code and try again."
        }
    }

    func show(room: String) async {
        guard let pairing else { status = "Pair an Apple TV first."; return }
        let room = room.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard room.range(of: "^[A-F0-9]{6}$", options: .regularExpression) != nil else {
            status = "Enter the six-character game code."
            return
        }
        do {
            let _: ShowResult = try await post("show", body: ["deviceId": pairing.deviceId,
                "controllerToken": pairing.controllerToken, "room": room])
            status = "Showing game \(room) on \(name)."
        } catch {
            status = "Could not reach the TV. Open its app, or pair again if needed."
        }
    }

    private struct ShowResult: Decodable { let ok: Bool }
    private func post<T: Decodable>(_ action: String, body: [String: String]) async throws -> T {
        var request = URLRequest(url: URL(string: "https://ff.adeticket.com/api/tv/\(action)")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse, response.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
