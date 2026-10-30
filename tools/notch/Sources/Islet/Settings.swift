import AppKit
import ServiceManagement
import SwiftUI

/// User preferences. The settings window edits them through @AppStorage with
/// the same keys; the model reads them at the moment it needs them.
enum Prefs {
    static let defaults: [String: Any] = [
        "openOnHover": false,
        "haptics": true,
        "liveActivity": true,
        "notifications": true,
        "calls": true,
        "notificationSeconds": 5.0,
        "inkwell": true,
    ]

    static func register() { UserDefaults.standard.register(defaults: defaults) }

    static var openOnHover: Bool { UserDefaults.standard.bool(forKey: "openOnHover") }
    static var haptics: Bool { UserDefaults.standard.bool(forKey: "haptics") }
    static var liveActivity: Bool { UserDefaults.standard.bool(forKey: "liveActivity") }
    static var notifications: Bool { UserDefaults.standard.bool(forKey: "notifications") }
    static var calls: Bool { UserDefaults.standard.bool(forKey: "calls") }
    static var notificationSeconds: Double { UserDefaults.standard.double(forKey: "notificationSeconds") }
    static var inkwell: Bool { UserDefaults.standard.bool(forKey: "inkwell") }
}

struct SettingsView: View {
    @AppStorage("openOnHover") private var openOnHover = false
    @AppStorage("haptics") private var haptics = true
    @AppStorage("liveActivity") private var liveActivity = true
    @AppStorage("notifications") private var notifications = true
    @AppStorage("calls") private var calls = true
    @AppStorage("notificationSeconds") private var notificationSeconds = 5.0
    @AppStorage("inkwell") private var inkwell = true
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled

    let hasNotificationAccess: () -> Bool
    let testNotification: () -> Void
    let testCall: () -> Void
    /// Pokes the notch so geometry-affecting prefs apply immediately.
    let refresh: () -> Void

    var body: some View {
        Form {
            Section("Notch") {
                Picker("Ochilishi", selection: $openOnHover) {
                    Text("Bosganda").tag(false)
                    Text("Sichqoncha borganda").tag(true)
                }
                Toggle("Musiqa notch yonida ko‘rinsin", isOn: $liveActivity)
                    .onChange(of: liveActivity) { refresh() }
                Toggle("Trackpad titrashi (haptic)", isOn: $haptics)
            }

            Section("Bildirishnomalar") {
                Toggle("Bildirishnomalarni ko‘rsatish", isOn: $notifications)
                Toggle("Qo‘ng‘iroqlarni ko‘rsatish", isOn: $calls)
                LabeledContent("Ko‘rinib turish vaqti") {
                    HStack {
                        Slider(value: $notificationSeconds, in: 3...12, step: 1).frame(width: 160)
                        Text("\(Int(notificationSeconds)) s").monospacedDigit().frame(width: 32, alignment: .trailing)
                    }
                }
                if hasNotificationAccess() {
                    Label("Full Disk Access berilgan", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                } else {
                    HStack {
                        Label("Full Disk Access kerak", systemImage: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                        Spacer()
                        Button("Ochish…") {
                            NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")!)
                        }
                    }
                }
                HStack {
                    Button("Sinov: bildirishnoma", action: testNotification)
                    Button("Sinov: qo‘ng‘iroq", action: testCall)
                }
            }

            Section("Inkwell") {
                Toggle("Inkwell bilan ulanish", isOn: $inkwell)
                    .onChange(of: inkwell) { refresh() }
                Text("Seriya, bugungi daqiqalar, maqola va so‘zlar notch’da; fokus taymeri notch yonida; muhim voqealar haqida xabar beradi.")
                    .font(.caption).foregroundStyle(.secondary)
            }

            Section("Umumiy") {
                Toggle("Kompyuter yonganda ishga tushirish", isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) {
                        do {
                            if launchAtLogin { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
                        } catch {
                            launchAtLogin = SMAppService.mainApp.status == .enabled
                        }
                    }
            }
        }
        .formStyle(.grouped)
        .frame(width: 440)
        .fixedSize()
    }
}
