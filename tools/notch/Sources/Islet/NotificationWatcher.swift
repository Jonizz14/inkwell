import AppKit
import CoreServices
import SQLite3

struct IncomingNotification: Identifiable, Equatable {
    let id: Int64
    let bundleID: String
    let appName: String
    let title: String
    let subtitle: String
    let body: String
    let icon: NSImage?
    let isCall: Bool
    /// Deep link to open on click instead of just bringing the app forward.
    var url: URL? = nil
    /// Inkwell's own messages show Inky instead of an app icon.
    var inky: InkyMood? = nil

    static func == (a: Self, b: Self) -> Bool { a.id == b.id }

    func openApp() {
        if let url { NSWorkspace.shared.open(url); return }
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) else { return }
        NSWorkspace.shared.openApplication(at: url, configuration: .init())
    }
}

/// Reads notifications other apps post, straight from Notification Center's
/// database. There is no public API for this, so it needs Full Disk Access.
/// Uses FSEvents on the database folder, so it costs nothing while idle.
final class NotificationWatcher {
    var onNotification: ((IncomingNotification) -> Void)?
    var onAccessChange: (() -> Void)?
    private(set) var hasAccess = false {
        didSet { if hasAccess != oldValue { onAccessChange?() } }
    }

    private let folder = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Group Containers/group.com.apple.usernoted/db2")
    private var db: OpaquePointer?
    private var lastID: Int64 = 0
    private var stream: FSEventStreamRef?
    private var retryTimer: Timer?
    private let queue = DispatchQueue(label: "islet.notifications")

    private static let callApps: Set<String> = [
        "com.apple.FaceTime", "com.apple.TelephonyUtilities", "com.apple.mobilephone",
        "com.apple.InCallService", "com.apple.CallHistory",
    ]
    private static let callWords = [
        "incoming call", "is calling", "video call", "voice call", "audio call",
        "входящий", "звонок", "вызов", "qo'ng'iroq", "qongiroq", "qo‘ng‘iroq",
    ]

    func start() {
        if openDatabase() {
            retryTimer?.invalidate()
            retryTimer = nil
            startStream()
        } else if retryTimer == nil {
            // Check again periodically until the user grants Full Disk Access.
            retryTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
                guard let self, self.openDatabase() else { return }
                self.retryTimer?.invalidate()
                self.retryTimer = nil
                self.startStream()
            }
        }
    }

    private func openDatabase() -> Bool {
        if db != nil { return true }
        let path = folder.appendingPathComponent("db").path
        var handle: OpaquePointer?
        guard sqlite3_open_v2(path, &handle, SQLITE_OPEN_READONLY, nil) == SQLITE_OK,
              let max = Self.scalar(handle, "SELECT IFNULL(MAX(rec_id), 0) FROM record") else {
            sqlite3_close(handle)
            hasAccess = false
            return false
        }
        db = handle
        lastID = max
        hasAccess = true
        return true
    }

    private func startStream() {
        guard stream == nil else { return }
        var context = FSEventStreamContext(version: 0, info: Unmanaged.passUnretained(self).toOpaque(), retain: nil, release: nil, copyDescription: nil)
        let callback: FSEventStreamCallback = { _, info, _, _, _, _ in
            guard let info else { return }
            Unmanaged<NotificationWatcher>.fromOpaque(info).takeUnretainedValue().readNew()
        }
        guard let s = FSEventStreamCreate(nil, callback, &context, [folder.path] as CFArray,
                                          FSEventStreamEventId(kFSEventStreamEventIdSinceNow), 0.15,
                                          FSEventStreamCreateFlags(kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagNoDefer)) else { return }
        FSEventStreamSetDispatchQueue(s, queue)
        FSEventStreamStart(s)
        stream = s
    }

    private func readNew() {
        guard let db else { return }
        let sql = "SELECT r.rec_id, a.identifier, r.data FROM record r JOIN app a ON a.app_id = r.app_id WHERE r.rec_id > ? ORDER BY r.rec_id"
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
        defer { sqlite3_finalize(stmt) }
        sqlite3_bind_int64(stmt, 1, lastID)

        var found: [IncomingNotification] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            let id = sqlite3_column_int64(stmt, 0)
            lastID = max(lastID, id)
            let appID = sqlite3_column_text(stmt, 1).map { String(cString: $0) } ?? ""
            guard let blob = sqlite3_column_blob(stmt, 2) else { continue }
            let data = Data(bytes: blob, count: Int(sqlite3_column_bytes(stmt, 2)))
            if let n = Self.parse(id: id, appID: appID, data: data) { found.append(n) }
        }
        // Several rows can land at once (e.g. after wake); show only the latest few.
        for n in found.suffix(3) {
            DispatchQueue.main.async { self.onNotification?(n) }
        }
    }

    private static func parse(id: Int64, appID: String, data: Data) -> IncomingNotification? {
        guard let root = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
              let req = root["req"] as? [String: Any] else { return nil }
        let bundle = (root["app"] as? String) ?? appID
        guard bundle != Bundle.main.bundleIdentifier else { return nil }
        let title = req["titl"] as? String ?? ""
        let subtitle = req["subt"] as? String ?? ""
        let body = req["body"] as? String ?? ""
        guard !(title.isEmpty && body.isEmpty) else { return nil }

        let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundle)
        let appName = appURL.flatMap { Bundle(url: $0)?.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String }
            ?? appURL?.deletingPathExtension().lastPathComponent
            ?? bundle.components(separatedBy: ".").last ?? bundle
        let icon = appURL.map { NSWorkspace.shared.icon(forFile: $0.path) }

        let text = "\(title) \(subtitle) \(body)".lowercased()
        let isCall = callApps.contains(bundle) || callWords.contains { text.contains($0) }
        return IncomingNotification(id: id, bundleID: bundle, appName: appName, title: title,
                                    subtitle: subtitle, body: body, icon: icon, isCall: isCall)
    }

    private static func scalar(_ db: OpaquePointer?, _ sql: String) -> Int64? {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return nil }
        defer { sqlite3_finalize(stmt) }
        return sqlite3_step(stmt) == SQLITE_ROW ? sqlite3_column_int64(stmt, 0) : nil
    }
}
