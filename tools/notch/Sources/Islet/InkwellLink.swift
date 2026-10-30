import AppKit
import CoreServices

/// What Inkwell publishes for its widgets (notify.js → widget.json).
struct InkwellState: Decodable, Equatable {
    struct Focus: Decodable, Equatable {
        var min: Int?
        var sessions: Int?
        var start: Double?   // ms since 1970
        var ends: Double?
        var title: String?
    }

    var streak: Int?
    var best: Int?
    var doneToday: Bool?
    var todayMin: Int?
    var due: Int?
    var word: String?
    var tr: String?
    var id: String?
    var title: String?
    var pct: Int?
    var left: Int?
    var goal: Int?
    var focus: Focus?
    var day: String?

    var focusStart: Date? { focus?.start.map { Date(timeIntervalSince1970: $0 / 1000) } }
    var focusEnd: Date? { focus?.ends.map { Date(timeIntervalSince1970: $0 / 1000) } }
    var focusActive: Bool { (focusEnd.map { $0 > Date() }) ?? false }
}

/// Two-way link with Inkwell without touching Inkwell itself: we follow the
/// state file it already writes for its widgets, and open places in it via its
/// `articles365://` links (article/<id>, cards, focus).
final class InkwellLink: ObservableObject {
    static let bundleID = "uz.javohir.articles365"

    @Published private(set) var state: InkwellState?
    @Published private(set) var focusActive = false
    var onEvent: ((IncomingNotification) -> Void)?

    let icon: NSImage?
    private let folder = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Containers/uz.javohir.articles365.widget/Data")
    private var stream: FSEventStreamRef?
    private var focusTimer: Timer?
    private var retryTimer: Timer?

    init() {
        icon = NSWorkspace.shared.urlForApplication(withBundleIdentifier: Self.bundleID)
            .map { NSWorkspace.shared.icon(forFile: $0.path) }
    }

    var isInstalled: Bool { icon != nil }

    func start() {
        guard isInstalled else { return }
        reload(announce: false)
        guard state != nil else {
            // No access yet (Full Disk Access pending) or Inkwell never ran: try later.
            retryTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
                guard let self else { return }
                self.reload(announce: false)
                if self.state != nil {
                    self.retryTimer?.invalidate()
                    self.watch()
                }
            }
            return
        }
        watch()
    }

    private func watch() {
        guard stream == nil else { return }
        var context = FSEventStreamContext(version: 0, info: Unmanaged.passUnretained(self).toOpaque(), retain: nil, release: nil, copyDescription: nil)
        let callback: FSEventStreamCallback = { _, info, _, _, _, _ in
            guard let info else { return }
            let link = Unmanaged<InkwellLink>.fromOpaque(info).takeUnretainedValue()
            DispatchQueue.main.async { link.reload(announce: true) }
        }
        guard let s = FSEventStreamCreate(nil, callback, &context, [folder.path] as CFArray,
                                          FSEventStreamEventId(kFSEventStreamEventIdSinceNow), 0.3,
                                          FSEventStreamCreateFlags(kFSEventStreamCreateFlagFileEvents)) else { return }
        FSEventStreamSetDispatchQueue(s, .main)
        FSEventStreamStart(s)
        stream = s
    }

    private func reload(announce: Bool) {
        guard let data = try? Data(contentsOf: folder.appendingPathComponent("widget.json")),
              let new = try? JSONDecoder().decode(InkwellState.self, from: data), new != state else { return }
        let old = state
        state = new
        updateFocus()
        if announce, let old { announceChanges(from: old, to: new) }
    }

    /// The focus timer ends on its own; Inkwell doesn't necessarily rewrite the file then.
    private func updateFocus() {
        focusTimer?.invalidate()
        focusActive = state?.focusActive ?? false
        guard focusActive, let end = state?.focusEnd else { return }
        focusTimer = Timer.scheduledTimer(withTimeInterval: end.timeIntervalSinceNow + 0.5, repeats: false) { [weak self] _ in
            guard let self else { return }
            self.focusActive = false
            self.post(id: 3, title: "Fokus tugadi 👏", body: self.state?.focus?.title ?? "Zo‘r ishladingiz. Biroz dam oling.", url: "articles365://focus", inky: .proud)
        }
    }

    private func announceChanges(from old: InkwellState, to new: InkwellState) {
        let sameDay = old.day == new.day
        if !old.focusActive, new.focusActive, let end = new.focusEnd {
            let minutes = Int((end.timeIntervalSinceNow / 60).rounded())
            post(id: 1, title: "Fokus boshlandi · \(minutes) daqiqa", body: new.focus?.title ?? "Telefonni chetga qo‘yamiz 📵", url: "articles365://focus", inky: .reading)
        }
        let goal = new.goal ?? 15
        if sameDay, (old.todayMin ?? 0) < goal, (new.todayMin ?? 0) >= goal {
            post(id: 2, title: "🎯 Bugungi maqsad bajarildi", body: "\(goal) daqiqa o‘qidingiz. Zo‘r!", url: nil, inky: .starry)
        } else if sameDay, old.doneToday == false, new.doneToday == true {
            let n = new.streak ?? 0
            let milestone = [3, 7, 14, 30, 50, 100, 150, 200, 250, 300, 365].contains(n)
            post(id: 4, title: milestone ? "🏆 \(n) kun ketma-ket!" : "🔥 \(n) kun — bugungisi saqlandi",
                 body: "Olov yonib turibdi. Ertaga ham kutamiz.", url: nil, inky: milestone ? .starry : .happy)
        }
        if (new.due ?? 0) > (old.due ?? 0), let word = new.word {
            post(id: 5, title: "«\(word)» — nima degani edi? 🤔", body: "\(new.due ?? 1) ta so‘z takrorlashni kutyapti.", url: "articles365://cards", inky: .idle)
        }
    }

    private func post(id: Int64, title: String, body: String, url: String?, inky: InkyMood) {
        onEvent?(IncomingNotification(id: -1_000_000 - id - Int64(Date().timeIntervalSince1970) * 10,
                                      bundleID: Self.bundleID, appName: "Inkwell", title: title, subtitle: "",
                                      body: body, icon: icon, isCall: false, url: url.flatMap(URL.init(string:)), inky: inky))
    }

    // MARK: Opening places in Inkwell

    func open(_ link: String) {
        guard let url = URL(string: link) else { return }
        NSWorkspace.shared.open(url)
    }

    func openArticle() {
        if let id = state?.id { open("articles365://article/\(id)") } else { open("articles365://open") }
    }
}
