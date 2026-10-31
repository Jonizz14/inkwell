import AppKit
import os
let debugLog = Logger(subsystem: "com.jakhongir.islet", category: "debug")
import SwiftUI
import UniformTypeIdentifiers

/// Something Inkwell is doing in the background (cleaning its cache, downloading an update,
/// adding articles), sent as islet://activity?kind=&phase=start|progress|done|cancel&p=&n=&text=
struct InkwellActivity: Equatable {
    var kind: String
    var progress: Double?
    var done = false
    var n: Double?
    var text: String?

    private var bytes: String { ByteCountFormatter.string(fromByteCount: Int64(n ?? 0), countStyle: .file) }

    var title: String {
        switch (kind, done) {
        case ("tidy", false), ("clear", false): return "Kesh tozalanmoqda"
        case ("tidy", true): return (n ?? 0) > 0 ? "Kesh tozalandi" : "Hammasi toza"
        case ("clear", true): return "Kesh tozalandi"
        case ("update", false): return "Yangilanish yuklanmoqda"
        case ("update", true): return "Yangilanish tayyor"
        case ("import", false): return "Maqola qo‘shilmoqda"
        case ("import", true): return "\(Int(n ?? 0)) ta maqola qo‘shildi"
        default: return done ? "Tayyor" : "Inkwell ishlayapti"
        }
    }

    var detail: String {
        switch (kind, done) {
        case ("tidy", true): return (n ?? 0) > 0 ? "\(bytes) joy bo‘shadi" : "Tozalaydigan narsa topilmadi"
        case ("clear", true): return "Maqolalar va eslatmalar joyida"
        case ("update", true): return "Inkwell’ni qayta oching"
        case ("update", false): return progress.map { "\(Int($0 * 100))%" } ?? "Boshlanmoqda…"
        default: return text ?? "Orqa fonda"
        }
    }

    /// Worth a note in the notch when it's over (an automatic clean that found nothing isn't).
    var worthNote: Bool { kind != "tidy" || (n ?? 0) > 0 }
}

final class NotchModel: ObservableObject {
    enum Mode: Equatable {
        case closed
        case expanded
        /// Incoming notifications, newest on top, up to three below the camera.
        case stack
        /// Files dragged over the notch: shelf on the left, AirDrop on the right.
        case airdrop
    }

    /// Sections of the open notch; only one shows at a time.
    enum Tab: String, CaseIterable {
        case home, music, inkwell, shelf, inbox

        var symbol: String {
            switch self {
            case .music: return "music.note"
            case .inkwell: return "book.closed.fill"
            case .home: return "square.grid.2x2.fill"
            case .shelf: return "tray.full.fill"
            case .inbox: return "bell.fill"
            }
        }
    }

    enum DropSide { case shelf, airdrop }

    static let stackVisible = 3

    @Published private(set) var mode: Mode = .closed
    @Published private(set) var tab: Tab = .home
    /// Pointer is resting on the closed notch: it swells a little, a click opens it.
    @Published private(set) var peeking = false
    @Published var notchSize: CGSize
    @Published var dropTargeted = false {
        didSet { if dropTargeted != oldValue { dropTargetChanged() } }
    }
    @Published var dropSide: DropSide = .shelf

    /// Notifications on screen right now (newest first).
    @Published private(set) var live: [IncomingNotification] = []
    /// Every notification that came in (newest first), kept between launches.
    @Published private(set) var box: [IncomingNotification] = []
    @Published private(set) var unread = 0
    @Published private(set) var shelf: [ShelfItem] = []
    @Published private(set) var activity: InkwellActivity?
    /// Bumped when something lands on the shelf, so its icon can hop.
    @Published private(set) var shelfBump = 0

    let player: NowPlaying
    let inkwell: InkwellLink
    private(set) var hovering = false
    private var hoverWork: DispatchWorkItem?
    private var dismissWork: DispatchWorkItem?
    private var activityWork: DispatchWorkItem?

    static let open = Animation.spring(response: 0.44, dampingFraction: 0.8)
    static let close = Animation.spring(response: 0.38, dampingFraction: 0.95)
    static let peek = Animation.spring(response: 0.3, dampingFraction: 0.7)
    static let row = Animation.spring(response: 0.42, dampingFraction: 0.78)

    init(notchSize: CGSize, player: NowPlaying, inkwell: InkwellLink, restore: Bool = true) {
        self.notchSize = notchSize
        self.player = player
        self.inkwell = inkwell
        guard restore else { return }
        box = (Store.read("inbox.json", as: [SavedNotification].self) ?? []).map(\.notification)
        unread = UserDefaults.standard.integer(forKey: "unread")
        shelf = (Store.read("shelf.json", as: [ShelfItem].self) ?? []).filter(\.exists)
    }

    var isOpen: Bool { mode != .closed }
    /// Inkwell focus session counting down in the closed notch; wins over everything.
    var showsFocus: Bool { mode == .closed && inkwell.focusActive && Prefs.inkwell }
    /// Inkwell working in the background: Inky on the left, its progress on the right.
    var showsActivity: Bool { mode == .closed && activity != nil && Prefs.inkwell && !showsFocus }
    var showsLiveActivity: Bool { mode == .closed && player.isPlaying && Prefs.liveActivity && !showsFocus && !showsActivity }
    /// Music keeps its wings beside the notch while notifications are shown.
    var showsMusicWings: Bool { mode == .stack && player.isPlaying && Prefs.liveActivity }
    var showsInkwellStrip: Bool { inkwell.state != nil && Prefs.inkwell }

    // MARK: Geometry (shared by the view and hit-testing)

    /// The artwork slot beside the closed notch: square, or 16:9 for a video.
    var wingArt: CGSize {
        let h = notchSize.height - 12
        return CGSize(width: player.artWide ? (h * 16 / 9).rounded() : h, height: h)
    }

    static let rowHeight: CGFloat = 58
    static let callHeight: CGFloat = 70
    static let rowGap: CGFloat = 6

    var stackShown: ArraySlice<IncomingNotification> { live.prefix(Self.stackVisible) }
    var stackMore: Int { max(0, live.count - Self.stackVisible) }

    static let inboxRow: CGFloat = 50

    func size(for mode: Mode) -> CGSize {
        let n = notchSize
        switch mode {
        case .closed:
            let base: CGSize
            if inkwell.focusActive && Prefs.inkwell {
                base = CGSize(width: n.width + 2 * 62, height: n.height)
            } else if activity != nil && Prefs.inkwell {
                base = CGSize(width: n.width + 2 * 62, height: n.height)
            } else if player.isPlaying && Prefs.liveActivity {
                base = CGSize(width: n.width + 2 * (wingArt.width + 18), height: n.height)
            } else {
                base = n
            }
            return peeking ? CGSize(width: base.width + 18, height: base.height + 6) : base
        case .expanded:
            let width = max(n.width + 300, 490)
            switch tab {
            case .inbox:
                let rows = CGFloat(min(max(box.count, 1), 4))
                return CGSize(width: width, height: n.height + 10 + 30 + rows * (Self.inboxRow + 4) + 14)
            case .shelf:
                return CGSize(width: width, height: n.height + 10 + 30 + 96 + 12)
            default:
                return CGSize(width: width, height: n.height + 122)
            }
        case .airdrop:
            return CGSize(width: max(n.width + 300, 500), height: n.height + 118)
        case .stack:
            let rows = stackShown.reduce(CGFloat(0)) { $0 + ($1.isCall ? Self.callHeight : Self.rowHeight) }
            let gaps = CGFloat(max(stackShown.count - 1, 0)) * Self.rowGap
            let more: CGFloat = live.count > 1 ? Self.rowGap + 20 : 0
            return CGSize(width: max(n.width + 260, 460), height: n.height + 8 + rows + gaps + more + 12)
        }
    }

    var currentSize: CGSize { size(for: mode) }

    private func set(_ new: Mode) {
        guard new != mode else { return }
        debugLog.notice("mode -> \(String(describing: new).prefix(30), privacy: .public)")
        withAnimation(new == .closed ? Self.close : Self.open) {
            mode = new
            peeking = new == .closed && hovering
        }
    }

    func haptic(_ pattern: NSHapticFeedbackManager.FeedbackPattern) {
        guard Prefs.haptics else { return }
        NSHapticFeedbackManager.defaultPerformer.perform(pattern, performanceTime: .now)
    }

    // MARK: Hover / click (driven from AppKit, see NotchHostingView)

    func setHovering(_ value: Bool) {
        guard value != hovering else { return }
        debugLog.notice("hover \(value)")
        hovering = value
        hoverWork?.cancel()
        if value {
            guard mode == .closed else { return }
            haptic(.alignment)
            withAnimation(Self.peek) { peeking = true }
            if Prefs.openOnHover {
                let work = DispatchWorkItem { [weak self] in
                    guard let self, self.hovering, self.mode == .closed else { return }
                    self.open()
                }
                hoverWork = work
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25, execute: work)
            }
            return
        }
        let work = DispatchWorkItem { [weak self] in
            guard let self, !self.hovering else { return }
            if self.peeking { withAnimation(Self.close) { self.peeking = false } }
            if self.mode == .expanded { self.set(.closed) }
        }
        hoverWork = work
        // Short grace period so a slightly sloppy pointer doesn't snap it shut.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35, execute: work)
    }

    var tabs: [Tab] { Tab.allCases.filter { $0 != .inkwell || showsInkwellStrip } }

    func select(_ new: Tab) {
        debugLog.notice("tab -> \(new.rawValue, privacy: .public)")
        guard new != tab else { return }
        haptic(.alignment)
        withAnimation(.spring(response: 0.36, dampingFraction: 0.84)) {
            tab = new
            if new == .inbox { markRead() }
        }
    }

    /// The section worth seeing right now when the notch opens.
    private func pickTab() {
        if player.isPlaying { tab = .music }
        else if inkwell.focusActive, showsInkwellStrip { tab = .inkwell }
        else if !tabs.contains(tab) { tab = .home }
    }

    func open(tab requested: Tab? = nil) {
        hoverWork?.cancel()
        if let requested, tabs.contains(requested) { tab = requested } else { pickTab() }
        if tab == .inbox { markRead() }
        set(.expanded)
    }

    /// A click on the notch that no button inside claimed.
    func click() {
        switch mode {
        case .closed:
            haptic(.levelChange)
            open()
        case .expanded:
            set(.closed)
        case .stack, .airdrop:
            break
        }
    }

    // MARK: Notifications: a stack on screen, and the box that keeps them

    func show(_ notification: IncomingNotification) {
        if notification.isCall ? !Prefs.calls : !Prefs.notifications { return }
        if !notification.transient {
            box.insert(notification, at: 0)
            if box.count > 200 { box.removeLast(box.count - 200) }
            unread += 1
            saveBox()
        }
        // looking at the open notch: the box takes it, the bell hops, nothing is snatched away
        if mode == .expanded && hovering { return }
        haptic(.levelChange)
        hoverWork?.cancel()
        withAnimation(Self.row) {
            live.removeAll { $0.id == notification.id }
            live.insert(notification, at: notification.isCall ? 0 : live.firstIndex { !$0.isCall } ?? live.count)
            if live.count > 50 { live.removeLast(live.count - 50) }
        }
        set(.stack)
        scheduleDismiss(after: live.contains { $0.isCall } ? 20 : Prefs.notificationSeconds + Double(min(live.count - 1, 3)))
    }

    private func scheduleDismiss(after seconds: TimeInterval) {
        dismissWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            // Keep it on screen while the pointer is resting on it.
            if self.hovering { self.scheduleDismiss(after: 1.5) } else { self.closeStack() }
        }
        dismissWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
    }

    /// Off the screen; they stay in the box.
    func closeStack() {
        dismissWork?.cancel()
        guard mode == .stack else { live = []; return }
        set(.closed)
        // emptied after the shape has closed over them
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak self] in
            guard let self, self.mode != .stack else { return }
            self.live = []
        }
    }

    /// One notification away from the stack (✕, swipe, or opened).
    func dismiss(_ n: IncomingNotification) {
        haptic(.alignment)
        if live.count <= 1 { return closeStack() }
        withAnimation(Self.row) { live.removeAll { $0.id == n.id } }
        if !live.contains(where: \.isCall) { scheduleDismiss(after: Prefs.notificationSeconds) }
    }

    func activate(_ n: IncomingNotification) {
        n.openApp()
        if mode == .stack { dismiss(n) }
    }

    /// "+N more" under the stack: the box has them all.
    func openBox() {
        dismissWork?.cancel()
        live = []
        open(tab: .inbox)
    }

    func markRead() {
        guard unread != 0 else { return }
        unread = 0
        UserDefaults.standard.set(0, forKey: "unread")
    }

    func remove(fromBox n: IncomingNotification) {
        haptic(.alignment)
        withAnimation(Self.row) { box.removeAll { $0.id == n.id } }
        saveBox()
    }

    func clearBox() {
        haptic(.levelChange)
        withAnimation(Self.row) { box = [] }
        markRead()
        saveBox()
    }

    private func saveBox() {
        guard Store.enabled else { return }
        UserDefaults.standard.set(unread, forKey: "unread")
        Store.write("inbox.json", box.map(SavedNotification.init))
    }

    // MARK: Inkwell working in the background

    func handleActivity(_ url: URL) {
        let q = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        let get = { (key: String) in q.first { $0.name == key }?.value }
        guard let kind = get("kind") else { return }
        let phase = get("phase") ?? "start"
        activityWork?.cancel()
        if phase == "cancel" {
            withAnimation(Self.open) { activity = nil }
            return
        }
        var next = InkwellActivity(kind: kind, progress: get("p").flatMap(Double.init),
                                   done: phase == "done", n: get("n").flatMap(Double.init), text: get("text"))
        if next.progress == nil, !next.done, activity?.kind == kind { next.progress = activity?.progress }
        withAnimation(Self.open) { activity = next }
        let work = DispatchWorkItem { [weak self] in withAnimation(Self.close) { self?.activity = nil } }
        activityWork = work
        if next.done {
            haptic(.levelChange)
            // the tick rests a moment beside the notch, then a short note says what happened
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.6, execute: work)
            if next.worthNote {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.7) { [weak self] in
                    guard let self else { return }
                    self.show(IncomingNotification(id: -2_000_000 - Int64(Date().timeIntervalSince1970), bundleID: InkwellLink.bundleID,
                                                   appName: "Inkwell", title: next.title, subtitle: "", body: next.detail,
                                                   icon: self.inkwell.icon, isCall: false,
                                                   url: next.kind == "update" ? URL(string: "articles365://open") : nil,
                                                   inky: .happy, transient: true))
                }
            }
        } else {
            // Inkwell went quiet (closed mid-way): don't keep spinning forever
            DispatchQueue.main.asyncAfter(deadline: .now() + 120, execute: work)
        }
    }

    // MARK: Files over the notch: the shelf or AirDrop

    private func dropTargetChanged() {
        if dropTargeted {
            set(.airdrop)
        } else if mode == .airdrop {
            // Let the drop handler run first; then settle.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
                guard let self, !self.dropTargeted, self.mode == .airdrop else { return }
                self.set(.closed)
            }
        }
    }

    func handleDrop(_ providers: [NSItemProvider]) -> Bool {
        let side = dropSide
        let group = DispatchGroup()
        var urls: [URL] = []
        let lock = NSLock()
        for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            group.enter()
            _ = provider.loadObject(ofClass: URL.self) { url, _ in
                if let url { lock.lock(); urls.append(url); lock.unlock() }
                group.leave()
            }
        }
        group.notify(queue: .main) { [weak self] in
            guard let self else { return }
            guard !urls.isEmpty else { return self.set(.closed) }
            if side == .shelf {
                self.pin(urls)
            } else {
                self.set(.closed)
                guard let service = NSSharingService(named: .sendViaAirDrop) else { return }
                NSApp.activate(ignoringOtherApps: true)
                service.perform(withItems: urls)
            }
        }
        return true
    }

    /// Pinned at the top of the screen: the shelf opens to show where they landed.
    func pin(_ urls: [URL]) {
        haptic(.levelChange)
        let known = Set(shelf.map(\.path))
        let new = urls.filter { !known.contains($0.path) }.map { ShelfItem(path: $0.path) }
        tab = .shelf
        set(.expanded)
        withAnimation(Self.row.delay(0.15)) {
            shelf.insert(contentsOf: new, at: 0)
            shelfBump += 1
        }
        saveShelf()
        // the pointer is usually gone by now (a drag doesn't report hover): close on our own
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.4) { [weak self] in
            guard let self, !self.hovering, self.mode == .expanded, self.tab == .shelf else { return }
            self.set(.closed)
        }
    }

    func unpin(_ item: ShelfItem) {
        haptic(.alignment)
        withAnimation(Self.row) { shelf.removeAll { $0.id == item.id } }
        saveShelf()
    }

    func clearShelf() {
        haptic(.levelChange)
        withAnimation(Self.row) { shelf = [] }
        saveShelf()
    }

    private func saveShelf() { Store.write("shelf.json", shelf) }

    static func openAirDropWindow() {
        let url = URL(fileURLWithPath: "/System/Library/CoreServices/Finder.app/Contents/Applications/AirDrop.app")
        NSWorkspace.shared.open(url)
    }
}
