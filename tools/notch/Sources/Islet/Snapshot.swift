import SwiftUI

/// `Islet --snapshot <dir>` renders each notch state to PNG for design checks.
@MainActor
enum Snapshot {
    static func run(into dir: String) {
        Prefs.register()
        let player = NowPlaying()
        let inkwell = InkwellLink()
        inkwell.start()
        let size = CGSize(width: 185, height: 32)
        let call = IncomingNotification(id: 1, bundleID: "com.apple.FaceTime", appName: "FaceTime", title: "Onam", subtitle: "",
                                        body: "iPhone orqali qo‘ng‘iroq", icon: nil, isCall: true)
        let note = IncomingNotification(id: 2, bundleID: "ru.keepcoder.Telegram", appName: "Telegram", title: "Aziz",
                                        subtitle: "", body: "Bro ertaga soat nechida uchrashamiz? Men 5 larda bo‘shman", icon: NSWorkspace.shared.icon(forFile: "/System/Applications/Messages.app"), isCall: false)
        let states: [(String, (NotchModel) -> Void)] = [
            ("closed", { _ in }),
            ("expanded", { $0.click() }),
            ("tab-music", { $0.open(tab: .music) }),
            ("tab-inkwell", { $0.open(tab: .inkwell) }),
            ("tab-home", { $0.open(tab: .home) }),
            ("notification", { $0.show(note) }),
            ("call", { $0.show(call) }),
            ("inky-hello", { $0.show(IncomingNotification(id: 9, bundleID: InkwellLink.bundleID, appName: "Inkwell", title: "Salom! Men Inky 👋",
                                                          subtitle: "", body: "Inkwell ulandi: seriya, fokus va so‘zlar endi shu yerda.",
                                                          icon: nil, isCall: false, inky: .hello)) }),
            ("airdrop", { $0.dropTargeted = true }),
        ]
        for (name, setup) in states {
            let model = NotchModel(notchSize: size, player: player, inkwell: inkwell)
            setup(model)
            let view = NotchRootView(model: model, player: player, inkwell: inkwell)
                .frame(width: 560, height: 200)
                .background(Color(white: 0.85))
            let renderer = ImageRenderer(content: view)
            renderer.scale = 2
            if let image = renderer.nsImage, let tiff = image.tiffRepresentation,
               let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) {
                try? png.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
            }
        }
    }
}
