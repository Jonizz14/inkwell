import SwiftUI

/// Inky, Inkwell's pixel mascot, living in the notch. Same frames as in Inkwell
/// (InkyFrames.swift); on black the ink body is drawn light and the eyes dark.
/// It moves like a sprite: whole frames a few times a second, only while shown.
enum InkyMood {
    case idle, hello, happy, reading, love, starry, proud, sleep
}

struct InkyView: View {
    let mood: InkyMood
    var pixel: CGFloat = 1.5

    private static let colors: [Character: Color] = [
        "X": Color(white: 0.95), "W": .black, "g": Color(white: 0.6),
        "R": Color(red: 0.9, green: 0.28, blue: 0.3), "P": Color(red: 0.96, green: 0.65, blue: 0.73),
        "B": Color(red: 0.37, green: 0.69, blue: 0.94), "Y": Color(red: 0.96, green: 0.77, blue: 0.26),
    ]

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.15)) { context in
            let rows = InkyFrames.all[frame(at: context.date.timeIntervalSinceReferenceDate)] ?? InkyFrames.all["idle"]!
            let px = crisp
            Canvas { ctx, _ in
                // one rectangle per run of a colour in a row: no seams between pixels
                for (y, row) in rows.enumerated() {
                    let chars = Array(row)
                    var x = 0
                    while x < chars.count {
                        let ch = chars[x]
                        var end = x + 1
                        while end < chars.count, chars[end] == ch { end += 1 }
                        if ch != "." {
                            ctx.fill(Path(CGRect(x: CGFloat(x) * px, y: CGFloat(y) * px, width: CGFloat(end - x) * px, height: px)),
                                     with: .color(Self.colors[ch] ?? .white))
                        }
                        x = end
                    }
                }
            }
        }
        .frame(width: 26 * crisp, height: 16 * crisp)
    }

    /// Whole device pixels on a Retina screen, so the sprite stays sharp.
    private var crisp: CGFloat { max(0.5, (pixel * 2).rounded(.down) / 2) }

    private func frame(at t: Double) -> String {
        let flip = { (period: Double) in t.truncatingRemainder(dividingBy: period * 2) < period }
        switch mood {
        case .hello: return flip(0.3) ? "wave" : "wave2"
        case .happy: return flip(0.6) ? "happy" : "happy2"
        case .love: return flip(0.5) ? "love" : "love2"
        case .starry: return flip(0.45) ? "starry" : "starry2"
        case .sleep: return flip(0.9) ? "sleep" : "sleep2"
        case .proud: return "proud"
        case .reading:
            let p = t.truncatingRemainder(dividingBy: 5)
            return p < 3.2 ? "read" : p < 4.1 ? "readL" : "readR"
        case .idle:
            let p = t.truncatingRemainder(dividingBy: 6)
            return p < 0.15 || (p > 3.0 && p < 3.15) ? "blink" : p > 4.4 && p < 5.0 ? "lookL" : p > 5.0 && p < 5.6 ? "lookR" : "idle"
        }
    }
}
