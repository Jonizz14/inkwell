import AppKit
import CoreImage

/// Now-playing state from any app (Spotify, Music, Safari, YouTube in Chrome…).
/// macOS only lets Apple-signed processes read MediaRemote, so the actual
/// listener runs inside /usr/bin/perl (see Helper/MediaRemoteBridge.m) and
/// streams JSON lines to us. Event-driven: no polling.
final class NowPlaying: ObservableObject {
    @Published private(set) var title = ""
    @Published private(set) var artist = ""
    @Published private(set) var isPlaying = false
    @Published private(set) var artwork: NSImage?
    @Published private(set) var accent: NSColor = .white
    @Published private(set) var appIcon: NSImage?
    @Published private(set) var duration: Double = 0
    private(set) var bundleID: String?
    private var elapsedAnchor: Double = 0
    private var anchorDate = Date()
    private var rate: Double = 0

    private var process: Process?
    private var input: FileHandle?
    private var buffer = Data()
    private var restartDelay: TimeInterval = 1
    private var clearWork: DispatchWorkItem?

    var hasTrack: Bool { !title.isEmpty }

    func elapsed(at date: Date) -> Double {
        guard duration > 0 else { return 0 }
        let value = elapsedAnchor + (isPlaying ? date.timeIntervalSince(anchorDate) * max(rate, 1) : 0)
        return min(max(value, 0), duration)
    }

    func start() {
        guard let dylib = Bundle.main.url(forResource: "MediaRemoteBridge", withExtension: "dylib") else {
            NSLog("Islet: MediaRemoteBridge.dylib missing from bundle")
            return
        }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/perl")
        p.arguments = ["-e", """
            use DynaLoader;
            my $l = DynaLoader::dl_load_file($ARGV[0], 0) or die DynaLoader::dl_error();
            DynaLoader::dl_install_xsub("main::run", DynaLoader::dl_find_symbol($l, "islet_run"));
            run();
            """, dylib.path]
        let out = Pipe(), inPipe = Pipe()
        p.standardOutput = out
        p.standardInput = inPipe
        p.standardError = FileHandle.nullDevice
        out.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { handle.readabilityHandler = nil; return }
            self?.consume(data)
        }
        p.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async { self?.scheduleRestart() }
        }
        do {
            try p.run()
            process = p
            input = inPipe.fileHandleForWriting
        } catch {
            NSLog("Islet: failed to start now-playing helper: \(error)")
            scheduleRestart()
        }
    }

    func stop() {
        process?.terminationHandler = nil
        process?.terminate()
        process = nil
    }

    private func scheduleRestart() {
        process = nil
        DispatchQueue.main.asyncAfter(deadline: .now() + restartDelay) { [weak self] in
            guard let self, self.process == nil else { return }
            self.restartDelay = min(self.restartDelay * 2, 30)
            self.start()
        }
    }

    // MARK: Commands

    func togglePlayPause() { send("toggle") }
    func next() { send("next") }
    func previous() { send("prev") }
    func seek(to seconds: Double) {
        elapsedAnchor = seconds
        anchorDate = Date()
        send("seek \(seconds)")
    }

    func openSourceApp() {
        guard let id = bundleID, let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: id) else { return }
        NSWorkspace.shared.openApplication(at: url, configuration: .init())
    }

    private func send(_ command: String) {
        input?.write(Data((command + "\n").utf8))
    }

    // MARK: Parsing (runs on the pipe's background queue)

    private func consume(_ data: Data) {
        buffer.append(data)
        while let nl = buffer.firstIndex(of: 0x0A) {
            let line = buffer[buffer.startIndex..<nl]
            buffer.removeSubrange(buffer.startIndex...nl)
            guard let obj = try? JSONSerialization.jsonObject(with: line) as? [String: Any] else { continue }
            apply(obj)
        }
    }

    private func apply(_ o: [String: Any]) {
        var newArtwork: NSImage??
        var newAccent: NSColor?
        if let art = o["art"] as? String {
            if let data = Data(base64Encoded: art), let image = NSImage(data: data) {
                newArtwork = .some(image)
                newAccent = Self.averageColor(of: data)
            } else {
                newArtwork = .some(nil)
            }
        }
        let bundle = o["bundle"] as? String
        let icon: NSImage? = bundle.flatMap { id in
            NSWorkspace.shared.urlForApplication(withBundleIdentifier: id).map { NSWorkspace.shared.icon(forFile: $0.path) }
        }

        let update = { [self] in
            restartDelay = 1
            title = o["title"] as? String ?? ""
            artist = o["artist"] as? String ?? ""
            duration = o["duration"] as? Double ?? 0
            rate = o["rate"] as? Double ?? 1
            elapsedAnchor = o["elapsed"] as? Double ?? 0
            if let ts = o["ts"] as? Double { anchorDate = Date(timeIntervalSince1970: ts) }
            isPlaying = (o["playing"] as? Bool ?? false) && !title.isEmpty
            if bundle != bundleID {
                bundleID = bundle
                appIcon = icon
            }
            if let newArtwork { artwork = newArtwork }
            if let newAccent { accent = newAccent }
        }

        DispatchQueue.main.async { [self] in
            clearWork?.cancel()
            // Players blank out for a beat when pausing or skipping; only treat
            // "nothing playing" as real if it lasts.
            if (o["title"] as? String ?? "").isEmpty, !title.isEmpty {
                let work = DispatchWorkItem(block: update)
                clearWork = work
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5, execute: work)
            } else {
                update()
            }
        }
    }

    private static let ciContext = CIContext(options: [.workingColorSpace: NSNull()])

    /// Brightened average color of the artwork, used to tint the equalizer.
    private static func averageColor(of data: Data) -> NSColor {
        guard let image = CIImage(data: data),
              let filter = CIFilter(name: "CIAreaAverage", parameters: [kCIInputImageKey: image, kCIInputExtentKey: CIVector(cgRect: image.extent)]),
              let output = filter.outputImage else { return .white }
        var px = [UInt8](repeating: 0, count: 4)
        ciContext.render(output, toBitmap: &px, rowBytes: 4, bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBA8, colorSpace: nil)
        let color = NSColor(red: CGFloat(px[0]) / 255, green: CGFloat(px[1]) / 255, blue: CGFloat(px[2]) / 255, alpha: 1)
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        color.usingColorSpace(.deviceRGB)?.getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        return NSColor(hue: h, saturation: min(s * 1.2, 0.85), brightness: max(b, 0.85), alpha: 1)
    }
}
