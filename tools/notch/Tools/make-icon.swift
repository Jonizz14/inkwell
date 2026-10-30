// Draws the Islet app icon (1024 px PNG): graphite tile with a black island
// holding album art and equalizer bars. Usage: swift Tools/make-icon.swift out.png
import AppKit

let size: CGFloat = 1024
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size), pixelsHigh: Int(size), bitsPerSample: 8,
                           samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let ctx = NSGraphicsContext.current!.cgContext

// Tile (macOS icon grid: 824 px body, 100 px margin).
let tile = CGRect(x: 100, y: 100, width: 824, height: 824)
let tilePath = CGPath(roundedRect: tile, cornerWidth: 185, cornerHeight: 185, transform: nil)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -10), blur: 24, color: NSColor.black.withAlphaComponent(0.35).cgColor)
ctx.addPath(tilePath)
ctx.setFillColor(NSColor(white: 0.93, alpha: 1).cgColor)
ctx.fillPath()
ctx.restoreGState()
ctx.saveGState()
ctx.addPath(tilePath)
ctx.clip()
let bg = CGGradient(colorsSpace: nil, colors: [NSColor(white: 0.97, alpha: 1).cgColor, NSColor(white: 0.80, alpha: 1).cgColor] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(bg, start: CGPoint(x: 0, y: tile.maxY), end: CGPoint(x: 0, y: tile.minY), options: [])

// The island.
let island = CGRect(x: 512 - 300, y: 512 - 92, width: 600, height: 184)
ctx.setShadow(offset: CGSize(width: 0, height: -14), blur: 40, color: NSColor.black.withAlphaComponent(0.35).cgColor)
ctx.addPath(CGPath(roundedRect: island, cornerWidth: 92, cornerHeight: 92, transform: nil))
ctx.setFillColor(NSColor.black.cgColor)
ctx.fillPath()
ctx.setShadow(offset: .zero, blur: 0, color: nil)

// Album art square on the left.
let art = CGRect(x: island.minX + 46, y: island.midY - 46, width: 92, height: 92)
ctx.addPath(CGPath(roundedRect: art, cornerWidth: 24, cornerHeight: 24, transform: nil))
ctx.clip()
let artGrad = CGGradient(colorsSpace: nil, colors: [NSColor(white: 1, alpha: 1).cgColor, NSColor(white: 0.55, alpha: 1).cgColor] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(artGrad, start: CGPoint(x: art.minX, y: art.maxY), end: CGPoint(x: art.maxX, y: art.minY), options: [])
ctx.resetClip()
ctx.addPath(tilePath)
ctx.clip()

// Equalizer bars on the right.
let heights: [CGFloat] = [0.45, 0.95, 0.65, 0.8]
let barW: CGFloat = 20, gap: CGFloat = 14
var x = island.maxX - 56 - (barW * 4 + gap * 3)
for h in heights {
    let bh = 96 * h
    ctx.addPath(CGPath(roundedRect: CGRect(x: x, y: island.midY - bh / 2, width: barW, height: bh), cornerWidth: barW / 2, cornerHeight: barW / 2, transform: nil))
    x += barW + gap
}
ctx.setFillColor(NSColor.white.cgColor)
ctx.fillPath()
ctx.restoreGState()

NSGraphicsContext.current = nil
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
