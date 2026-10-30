import AppKit
import SwiftUI

/// Bouncing bars driven by Core Animation, so they run in the render server
/// and cost the app no CPU while music plays.
struct Equalizer: NSViewRepresentable {
    let color: NSColor
    let playing: Bool

    func makeNSView(context: Context) -> EqualizerView { EqualizerView() }

    func updateNSView(_ view: EqualizerView, context: Context) {
        view.update(color: color, playing: playing)
    }
}

final class EqualizerView: NSView {
    private let bars: [CALayer] = (0..<4).map { _ in CALayer() }
    private let durations: [CFTimeInterval] = [0.42, 0.58, 0.36, 0.5]
    private var playing = false

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        bars.forEach { layer?.addSublayer($0) }
    }

    required init?(coder: NSCoder) { fatalError() }

    override func layout() {
        super.layout()
        let gap: CGFloat = 2
        let w = (bounds.width - gap * CGFloat(bars.count - 1)) / CGFloat(bars.count)
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        for (i, bar) in bars.enumerated() {
            bar.bounds = CGRect(x: 0, y: 0, width: w, height: bounds.height)
            bar.position = CGPoint(x: CGFloat(i) * (w + gap) + w / 2, y: bounds.midY)
            bar.cornerRadius = w / 2
        }
        CATransaction.commit()
    }

    func update(color: NSColor, playing: Bool) {
        bars.forEach { $0.backgroundColor = color.cgColor }
        guard playing != self.playing || bars[0].animationKeys() == nil else { return }
        self.playing = playing
        for (i, bar) in bars.enumerated() {
            bar.removeAllAnimations()
            if playing {
                let a = CABasicAnimation(keyPath: "transform.scale.y")
                a.fromValue = 0.25
                a.toValue = 1
                a.duration = durations[i]
                a.autoreverses = true
                a.repeatCount = .infinity
                a.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
                a.beginTime = CACurrentMediaTime() - Double(i) * 0.13
                bar.add(a, forKey: "bounce")
            } else {
                bar.transform = CATransform3DMakeScale(1, 0.25, 1)
            }
        }
    }
}
