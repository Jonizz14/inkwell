import AppKit
import os
let debugLog = Logger(subsystem: "com.jakhongir.islet", category: "debug")
import SwiftUI
import UniformTypeIdentifiers

final class NotchModel: ObservableObject {
    enum Mode: Equatable {
        case closed
        case expanded
        case notification(IncomingNotification)
        case airdrop
    }

    /// Sections of the open notch; only one shows at a time.
    enum Tab: String, CaseIterable {
        case music, inkwell, home

        var symbol: String {
            switch self {
            case .music: return "music.note"
            case .inkwell: return "book.closed.fill"
            case .home: return "square.grid.2x2.fill"
            }
        }
    }

    @Published private(set) var mode: Mode = .closed
    @Published private(set) var tab: Tab = .home
    /// Pointer is resting on the closed notch: it swells a little, a click opens it.
    @Published private(set) var peeking = false
    @Published var notchSize: CGSize
    @Published var dropTargeted = false {
        didSet { if dropTargeted != oldValue { dropTargetChanged() } }
    }

    let player: NowPlaying
    let inkwell: InkwellLink
    private(set) var hovering = false
    private var pending: [IncomingNotification] = []
    private var hoverWork: DispatchWorkItem?
    private var dismissWork: DispatchWorkItem?

    static let open = Animation.spring(response: 0.44, dampingFraction: 0.8)
    static let close = Animation.spring(response: 0.38, dampingFraction: 0.95)
    static let peek = Animation.spring(response: 0.3, dampingFraction: 0.7)

    init(notchSize: CGSize, player: NowPlaying, inkwell: InkwellLink) {
        self.notchSize = notchSize
        self.player = player
        self.inkwell = inkwell
    }

    var isOpen: Bool { mode != .closed }
    /// Inkwell focus session counting down in the closed notch; wins over music.
    var showsFocus: Bool { mode == .closed && inkwell.focusActive && Prefs.inkwell }
    var showsLiveActivity: Bool { mode == .closed && player.isPlaying && Prefs.liveActivity && !showsFocus }
    /// Music keeps its wings beside the notch while a notification is shown.
    var showsMusicWings: Bool {
        if case .notification = mode { return player.isPlaying && Prefs.liveActivity }
        return false
    }
    var showsInkwellStrip: Bool { inkwell.state != nil && Prefs.inkwell }

    // MARK: Geometry (shared by the view and hit-testing)

    func size(for mode: Mode) -> CGSize {
        let n = notchSize
        switch mode {
        case .closed:
            let base: CGSize
            if inkwell.focusActive && Prefs.inkwell {
                base = CGSize(width: n.width + 2 * 62, height: n.height)
            } else if player.isPlaying && Prefs.liveActivity {
                base = CGSize(width: n.width + 2 * (n.height + 6), height: n.height)
            } else {
                base = n
            }
            return peeking ? CGSize(width: base.width + 18, height: base.height + 6) : base
        case .expanded:
            return CGSize(width: max(n.width + 300, 490), height: n.height + 122)
        case .airdrop:
            return CGSize(width: max(n.width + 280, 480), height: n.height + 118)
        case .notification(let item):
            return CGSize(width: max(n.width + 240, 440), height: n.height + (item.isCall ? 92 : 76))
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

    private func haptic(_ pattern: NSHapticFeedbackManager.FeedbackPattern) {
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
        withAnimation(.spring(response: 0.34, dampingFraction: 0.86)) { tab = new }
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
        case .notification(let n):
            n.openApp()
            dismissNotification()
        case .airdrop:
            break
        }
    }

    // MARK: Notifications

    func show(_ notification: IncomingNotification) {
        if notification.isCall ? !Prefs.calls : !Prefs.notifications { return }
        if case .notification = mode {
            if notification.isCall {
                // Calls jump the queue.
                pending.insert(notification, at: 0)
                advance()
            } else {
                pending.append(notification)
            }
            return
        }
        present(notification)
    }

    private func present(_ n: IncomingNotification) {
        haptic(.levelChange)
        hoverWork?.cancel()
        set(.notification(n))
        scheduleDismiss(after: n.isCall ? 20 : Prefs.notificationSeconds)
    }

    private func scheduleDismiss(after seconds: TimeInterval) {
        dismissWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            // Keep it on screen while the pointer is resting on it.
            if self.hovering { self.scheduleDismiss(after: 1.5) } else { self.advance() }
        }
        dismissWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
    }

    func dismissNotification() {
        advance()
    }

    private func advance() {
        dismissWork?.cancel()
        if pending.isEmpty {
            set(.closed)
        } else {
            present(pending.removeFirst())
        }
    }

    // MARK: AirDrop

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
            self?.set(.closed)
            guard !urls.isEmpty, let service = NSSharingService(named: .sendViaAirDrop) else { return }
            NSApp.activate(ignoringOtherApps: true)
            service.perform(withItems: urls)
        }
        return true
    }

    static func openAirDropWindow() {
        let url = URL(fileURLWithPath: "/System/Library/CoreServices/Finder.app/Contents/Applications/AirDrop.app")
        NSWorkspace.shared.open(url)
    }
}
