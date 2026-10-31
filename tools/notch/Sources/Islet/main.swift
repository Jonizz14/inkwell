import AppKit
import Combine
import ServiceManagement
import SwiftUI

/// Borderless overlay pinned over the notch. Only the black shape takes the
/// pointer; everywhere else clicks fall through to the menu bar.
final class NotchPanel: NSPanel {
    static let canvas = CGSize(width: 680, height: 360)

    init() {
        super.init(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        level = .mainMenu + 3
        collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        isMovable = false
        hidesOnDeactivate = false
        isReleasedWhenClosed = false
    }

    // Never key: clicking the notch must not steal typing focus from the user's app.
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

/// Hosts the SwiftUI notch and owns pointer handling. SwiftUI's own hover and
/// tap gestures are unreliable in a non-activating overlay panel, so hover is
/// computed from the pointer position against the notch's target rect.
final class NotchHostingView: NSHostingView<NotchRootView> {
    var model: NotchModel!
    private var globalMonitor: Any?

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    /// The notch's resting rect for the current state, in window coordinates.
    private func notchRect(slack: CGFloat = 0) -> NSRect {
        let s = model.currentSize
        return NSRect(x: bounds.midX - s.width / 2, y: bounds.maxY - s.height, width: s.width, height: s.height)
            .insetBy(dx: -slack, dy: -slack)
    }

    override func hitTest(_ point: NSPoint) -> NSView? {
        notchRect().contains(point) ? super.hitTest(point) : nil
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        for area in trackingAreas where area.userInfo?["islet"] != nil { removeTrackingArea(area) }
        addTrackingArea(NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .mouseMoved, .activeAlways, .inVisibleRect],
                                       owner: self, userInfo: ["islet": true]))
    }

    override func mouseEntered(with event: NSEvent) { super.mouseEntered(with: event); updateHover() }
    override func mouseMoved(with event: NSEvent) { super.mouseMoved(with: event); updateHover() }
    override func mouseExited(with event: NSEvent) { super.mouseExited(with: event); updateHover() }

    private func updateHover() {
        guard let window else { return }
        let point = window.convertPoint(fromScreen: NSEvent.mouseLocation)
        // A little slack once inside, so the edge doesn't flicker as the shape swells.
        let inside = notchRect(slack: model.hovering ? 10 : 0).contains(point)
        if inside != model.hovering { model.setHovering(inside) }
        // While the pointer is on the notch, also follow it outside our window
        // (transparent areas belong to other apps). Off otherwise: zero idle cost.
        if inside, globalMonitor == nil {
            globalMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged]) { [weak self] _ in
                self?.updateHover()
            }
        } else if !inside, let monitor = globalMonitor {
            NSEvent.removeMonitor(monitor)
            globalMonitor = nil
        }
    }

    override func mouseDown(with event: NSEvent) {
        switch model.mode {
        case .closed:
            model.click()
        default:
            // Open notch / notifications: their own buttons take the click.
            super.mouseDown(with: event)
        }
    }
}

extension NSScreen {
    /// The screen with a camera housing, if any.
    static var notched: NSScreen? { screens.first { $0.safeAreaInsets.top > 0 } }

    var notchSize: CGSize {
        guard safeAreaInsets.top > 0, let left = auxiliaryTopLeftArea, let right = auxiliaryTopRightArea else {
            // No hardware notch (external display): draw a slim virtual one.
            return CGSize(width: 190, height: max(NSStatusBar.system.thickness, 24))
        }
        return CGSize(width: frame.width - left.width - right.width, height: safeAreaInsets.top)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private let player = NowPlaying()
    private let watcher = NotificationWatcher()
    private let inkwell = InkwellLink()
    private var model: NotchModel!
    private var panel: NotchPanel!
    private var statusItem: NSStatusItem!

    func applicationDidFinishLaunching(_ notification: Notification) {
        // One notch only: the copy inside Inkwell and a standalone Islet share an id. A second
        // copy stays just long enough to pass on the link it was opened with, then leaves.
        if NSRunningApplication.runningApplications(withBundleIdentifier: Bundle.main.bundleIdentifier ?? "")
            .contains(where: { $0 != .current }) {
            isDuplicate = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { NSApp.terminate(nil) }
            return
        }
        DistributedNotificationCenter.default().addObserver(forName: Self.forwardName, object: nil, queue: .main) { [weak self] note in
            guard let link = note.object as? String, let url = URL(string: link) else { return }
            self?.handle(url)
        }
        Prefs.register()
        let screen = NSScreen.notched ?? NSScreen.main!
        model = NotchModel(notchSize: screen.notchSize, player: player, inkwell: inkwell)

        panel = NotchPanel()
        let host = NotchHostingView(rootView: NotchRootView(model: model, player: player, inkwell: inkwell))
        host.model = model
        host.sizingOptions = []
        panel.acceptsMouseMovedEvents = true
        panel.contentView = host
        place(on: screen)
        panel.orderFrontRegardless()

        player.start()
        watcher.onNotification = { [weak self] in self?.model.show($0) }
        watcher.onAccessChange = { [weak self] in self?.writeStatus() }
        watcher.onChange = { [weak self] in self?.model.notificationsChanged() }
        model.callExists = { [weak self] id in self?.watcher.exists(id) ?? true }
        watcher.start()
        writeStatus()
        // without Full Disk Access no notification or call can reach the notch: say so, in the notch
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            guard let self, !self.watcher.hasAccess else { return }
            self.model.show(IncomingNotification(id: -3_000_000, bundleID: "com.apple.systempreferences", appName: "Islet",
                                                 title: "Xabarlar uchun ruxsat kerak",
                                                 subtitle: "", body: "Bosing → Full Disk Access’da Islet’ni o‘chirib, qayta yoqing",
                                                 icon: NSWorkspace.shared.icon(forFile: Bundle.main.bundlePath), isCall: false,
                                                 url: URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"),
                                                 transient: true))
        }
        if ProcessInfo.processInfo.environment["ISLET_DEBUG"] != nil { listenForDebugClicks() }
        inkwell.onEvent = { [weak self] in self?.model.show($0) }
        inkwell.start()
        // Inkwell's connect checklist waits for these to show up in the status
        inkwellWatch = inkwell.$state.map { $0 != nil }.removeDuplicates()
            .sink { [weak self] _ in DispatchQueue.main.async { self?.writeStatus() } }

        setUpStatusItem()
        NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self, let screen = NSScreen.notched ?? NSScreen.main else { return }
            self.model.notchSize = screen.notchSize
            self.place(on: screen)
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        // a duplicate must not take the running copy's status with it
        guard !isDuplicate else { return }
        player.stop()
        try? FileManager.default.removeItem(at: Self.statusURL)
    }

    // MARK: Talking to Inkwell (and anyone else)

    /// islet://settings · islet://test · islet://open/<music|inkwell|home> · islet://quit
    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls where url.scheme == "islet" {
            if isDuplicate {
                DistributedNotificationCenter.default().postNotificationName(Self.forwardName, object: url.absoluteString, userInfo: nil, deliverImmediately: true)
            } else {
                handle(url)
            }
        }
    }

    static let forwardName = Notification.Name("com.jakhongir.islet.url")
    private var isDuplicate = false
    private var inkwellWatch: AnyCancellable?
    private var lastHello: Date?

    private func handle(_ url: URL) {
        switch url.host {
        case "settings": openSettings()
        case "test":
            model.show(IncomingNotification(id: -Int64(Date().timeIntervalSince1970) - 7, bundleID: InkwellLink.bundleID,
                                            appName: "Inkwell", title: "Salom! Men Inky 👋", subtitle: "",
                                            body: "Inkwell ulandi: seriya, fokus va so‘zlar endi shu yerda.",
                                            icon: inkwell.icon ?? NSWorkspace.shared.icon(forFile: Bundle.main.bundlePath), isCall: false,
                                            url: URL(string: "articles365://open"), inky: .hello))
            lastHello = Date()
            writeStatus()
        case "open": model.open(tab: NotchModel.Tab(rawValue: url.lastPathComponent))
        // Inkwell working in the background (notch.js activity)
        case "activity": model.handleActivity(url)
        case "quit": NSApp.terminate(nil)
        default: break
        }
    }

    static let statusURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("Islet/status.json")

    /// Read by Inkwell's settings to show what the notch can do right now.
    private func writeStatus() {
        let status: [String: Any] = [
            "pid": ProcessInfo.processInfo.processIdentifier,
            "version": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "",
            "notifications": watcher.hasAccess,
            "inkwell": inkwell.state != nil,
            "hello": lastHello.map { $0.timeIntervalSince1970 * 1000 } ?? 0,
            "path": Bundle.main.bundlePath,
        ]
        try? FileManager.default.createDirectory(at: Self.statusURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        if let data = try? JSONSerialization.data(withJSONObject: status) { try? data.write(to: Self.statusURL) }
    }

    /// ISLET_DEBUG=1: `com.jakhongir.islet.debug.click` with "x,y" (window points from
    /// the top-left) clicks inside the panel, to test buttons without a real mouse.
    private func listenForDebugClicks() {
        DistributedNotificationCenter.default().addObserver(forName: .init("com.jakhongir.islet.debug.click"), object: nil, queue: .main) { [weak self] note in
            guard let self, let parts = (note.object as? String)?.split(separator: ",").compactMap({ Double($0) }), parts.count == 2 else { return }
            let point = NSPoint(x: parts[0], y: self.panel.frame.height - parts[1])
            for type in [NSEvent.EventType.leftMouseDown, .leftMouseUp] {
                if let e = NSEvent.mouseEvent(with: type, location: point, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime,
                                              windowNumber: self.panel.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: 1) {
                    self.panel.sendEvent(e)
                }
            }
            NSLog("Islet debug: clicked %@ → mode %@ tab %@", note.object as? String ?? "", String(describing: self.model.mode).prefix(20) as CVarArg, self.model.tab.rawValue)
        }
    }

    private func place(on screen: NSScreen) {
        let size = NotchPanel.canvas
        let midX = screen.frame.midX
        panel.setFrame(NSRect(x: midX - size.width / 2, y: screen.frame.maxY - size.height, width: size.width, height: size.height), display: true)
    }

    // MARK: Menu bar

    private func setUpStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = NSImage(systemSymbolName: "capsule.portrait.fill", accessibilityDescription: "Islet")?
            .withSymbolConfiguration(.init(pointSize: 11, weight: .regular))
        let menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu
    }

    private var settingsWindow: NSWindow?

    @objc func openSettings() {
        if settingsWindow == nil {
            let view = SettingsView(
                hasNotificationAccess: { [weak self] in self?.watcher.hasAccess ?? false },
                testNotification: { [weak self] in self?.testNotification() },
                testCall: { [weak self] in self?.testCall() },
                refresh: { [weak self] in
                    guard let model = self?.model else { return }
                    withAnimation(NotchModel.open) { model.objectWillChange.send() }
                })
            let window = NSWindow(contentViewController: NSHostingController(rootView: view))
            window.title = "Islet sozlamalari"
            window.styleMask = [.titled, .closable]
            window.isReleasedWhenClosed = false
            settingsWindow = window
        }
        NSApp.activate(ignoringOtherApps: true)
        settingsWindow?.center()
        settingsWindow?.makeKeyAndOrderFront(nil)
    }

    @objc private func openFullDiskAccess() {
        NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")!)
    }

    @objc private func testNotification() {
        model.show(IncomingNotification(id: -Int64(Date().timeIntervalSince1970), bundleID: "com.apple.finder", appName: "Islet",
                                        title: "Salom! 👋", subtitle: "", body: "Bildirishnomalar notch’da shunday ko‘rinadi.",
                                        icon: NSWorkspace.shared.icon(forFile: Bundle.main.bundlePath), isCall: false))
    }

    @objc private func testCall() {
        model.show(IncomingNotification(id: -Int64(Date().timeIntervalSince1970) - 1, bundleID: "com.apple.FaceTime", appName: "FaceTime",
                                        title: "Onam", subtitle: "", body: "iPhone orqali qo‘ng‘iroq", icon: nil, isCall: true))
    }

    @objc private func quit() { NSApp.terminate(nil) }
}

extension AppDelegate: NSMenuDelegate {
    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        let header = NSMenuItem(title: "Islet", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)
        menu.addItem(.separator())

        if watcher.hasAccess {
            let ok = NSMenuItem(title: "Bildirishnomalar: ulangan ✓", action: nil, keyEquivalent: "")
            ok.isEnabled = false
            menu.addItem(ok)
        } else {
            menu.addItem(NSMenuItem(title: "Bildirishnomalar uchun Full Disk Access berish…", action: #selector(openFullDiskAccess), keyEquivalent: ""))
        }
        menu.addItem(NSMenuItem(title: "Sozlamalar…", action: #selector(openSettings), keyEquivalent: ","))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Sinov: bildirishnoma", action: #selector(testNotification), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "Sinov: qo‘ng‘iroq", action: #selector(testCall), keyEquivalent: ""))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Chiqish", action: #selector(quit), keyEquivalent: "q"))
        menu.items.forEach { if $0.action != nil { $0.target = self } }
    }
}

if let i = CommandLine.arguments.firstIndex(of: "--snapshot"), i + 1 < CommandLine.arguments.count {
    MainActor.assumeIsolated { Snapshot.run(into: CommandLine.arguments[i + 1]) }
    exit(0)
}

// `Islet --send islet://test`: hand a link to the copy that is running, then exit. Inkwell
// talks to the notch this way, so it never depends on which copy macOS would open a link with.
if let i = CommandLine.arguments.firstIndex(of: "--send"), i + 1 < CommandLine.arguments.count {
    DistributedNotificationCenter.default().postNotificationName(AppDelegate.forwardName, object: CommandLine.arguments[i + 1],
                                                                 userInfo: nil, deliverImmediately: true)
    RunLoop.main.run(until: Date().addingTimeInterval(0.2))
    exit(0)
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
