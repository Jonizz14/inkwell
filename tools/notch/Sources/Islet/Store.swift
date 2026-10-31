import AppKit
import QuickLookThumbnailing
import SwiftUI

/// Islet's own small files: the notification box and the shelf, in
/// ~/Library/Application Support/Islet. Written off the main thread.
enum Store {
    static let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("Islet")
    private static let queue = DispatchQueue(label: "islet.store", qos: .utility)
    /// Off for `--snapshot`, so design renders never touch the real box and shelf.
    static var enabled = true

    static func read<T: Decodable>(_ name: String, as type: T.Type) -> T? {
        guard let data = try? Data(contentsOf: folder.appendingPathComponent(name)) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .secondsSince1970
        return try? decoder.decode(type, from: data)
    }

    static func write<T: Encodable>(_ name: String, _ value: T) {
        guard enabled else { return }
        queue.async {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .secondsSince1970
            guard let data = try? encoder.encode(value) else { return }
            try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try? data.write(to: folder.appendingPathComponent(name), options: .atomic)
        }
    }
}

/// App icons by bundle id, looked up once.
enum Icons {
    private static var cache: [String: NSImage] = [:]

    static func of(_ bundleID: String) -> NSImage? {
        if let icon = cache[bundleID] { return icon }
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) else { return nil }
        let icon = NSWorkspace.shared.icon(forFile: url.path)
        cache[bundleID] = icon
        return icon
    }
}

/// A notification as kept in the box (the icon is looked up again from the bundle id).
struct SavedNotification: Codable {
    var id: Int64
    var bundleID: String
    var appName: String
    var title: String
    var subtitle: String
    var body: String
    var date: Date
    var url: String?
    var isCall: Bool
    var inky: InkyMood?
    var image: String?

    init(_ n: IncomingNotification) {
        id = n.id; bundleID = n.bundleID; appName = n.appName; title = n.title; subtitle = n.subtitle
        body = n.body; date = n.date; url = n.url?.absoluteString; isCall = n.isCall; inky = n.inky; image = n.imagePath
    }

    var notification: IncomingNotification {
        IncomingNotification(id: id, bundleID: bundleID, appName: appName, title: title, subtitle: subtitle, body: body,
                             icon: Icons.of(bundleID), isCall: isCall, url: url.flatMap(URL.init(string:)), inky: inky,
                             date: date, imagePath: image)
    }
}

/// A file pinned to the shelf at the top of the screen.
struct ShelfItem: Codable, Identifiable, Equatable {
    var id = UUID()
    var path: String
    var added = Date()

    var url: URL { URL(fileURLWithPath: path) }
    var name: String { url.lastPathComponent }
    var exists: Bool { FileManager.default.fileExists(atPath: path) }
}

/// Quick Look pictures of files (photos, videos, PDFs…); the file's icon until one is ready.
final class Thumbnails {
    static let shared = Thumbnails()
    private let cache = NSCache<NSString, NSImage>()

    func cached(_ url: URL) -> NSImage? { cache.object(forKey: url.path as NSString) }

    func make(_ url: URL, side: CGFloat) async -> NSImage? {
        if let image = cached(url) { return image }
        let request = QLThumbnailGenerator.Request(fileAt: url, size: CGSize(width: side, height: side),
                                                   scale: NSScreen.main?.backingScaleFactor ?? 2, representationTypes: .thumbnail)
        guard let rep = try? await QLThumbnailGenerator.shared.generateBestRepresentation(for: request) else { return nil }
        cache.setObject(rep.nsImage, forKey: url.path as NSString)
        return rep.nsImage
    }
}

/// A file's picture, keeping its own shape (a 16:9 video frame stays 16:9) when `fit` is set.
struct FileThumb: View {
    let url: URL
    var side: CGFloat = 120
    var fill = true
    @State private var image: NSImage?

    var body: some View {
        Group {
            if let image {
                Image(nsImage: image).resizable().aspectRatio(contentMode: fill ? .fill : .fit)
                    .transition(.opacity.combined(with: .scale(scale: 0.92)))
            } else {
                Image(nsImage: NSWorkspace.shared.icon(forFile: url.path)).resizable().aspectRatio(contentMode: .fit)
            }
        }
        .task(id: url) {
            if let ready = Thumbnails.shared.cached(url) { image = ready; return }
            let made = await Thumbnails.shared.make(url, side: side)
            withAnimation(.easeOut(duration: 0.25)) { image = made }
        }
    }
}
