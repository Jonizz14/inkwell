// Reads every page of a PDF with Apple's Vision OCR and prints JSON lines:
//   {"page":1,"w":595,"h":842,"text":true|false,"lines":[{"x","y","w","h","text","conf","words":[[x0,x1],...]}]}
// Coordinates are PDF points with y measured from the bottom (like pdf.js).
// Pages that already have a text layer are reported with text:true and no OCR.
//
//   swiftc -O tools/vision-ocr.swift -o tools/vision-ocr
//   tools/vision-ocr file.pdf [--all] [--png outdir]
//     --all   OCR pages even when they have a text layer
//     --png   also save each rendered page as outdir/<page>.png
//     --width render width in pixels before OCR (default 2600)
import Foundation
import PDFKit
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count >= 2, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
  FileHandle.standardError.write("usage: vision-ocr file.pdf [--all] [--png dir]\n".data(using: .utf8)!)
  exit(1)
}
let forceAll = args.contains("--all")
var pngDir: String? = nil
if let i = args.firstIndex(of: "--png"), i + 1 < args.count { pngDir = args[i + 1] }
var renderWidth: CGFloat = 2600
if let i = args.firstIndex(of: "--width"), i + 1 < args.count, let w = Double(args[i + 1]) { renderWidth = CGFloat(w) }

func render(_ page: PDFPage, width target: CGFloat) -> CGImage? {
  let box = page.bounds(for: .mediaBox)
  let scale = target / box.width
  let w = Int(box.width * scale), h = Int(box.height * scale)
  guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
  ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
  ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
  ctx.scaleBy(x: scale, y: scale)
  // draw(with:) already puts the box's origin at (0,0); pages whose box starts
  // at e.g. (101,157) must not be shifted again
  page.draw(with: .mediaBox, to: ctx)
  return ctx.makeImage()
}

func recognize(_ img: CGImage, box: CGRect, roi: CGRect) -> [[String: Any]] {
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.usesLanguageCorrection = true
  req.recognitionLanguages = ["en-US"]
  req.minimumTextHeight = 0
  req.regionOfInterest = roi
  try? VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
  var out: [[String: Any]] = []
  for o in req.results ?? [] {
    guard let c = o.topCandidates(1).first else { continue }
    let b = o.boundingBox // normalized to the region, origin bottom-left
    let x = roi.minX + b.minX * roi.width, y = roi.minY + b.minY * roi.height
    // left/right edge of every space-separated word, so a line that Vision ran
    // across a narrow column gutter can be split again
    var words: [[CGFloat]] = []
    var i = c.string.startIndex
    for part in c.string.split(separator: " ", omittingEmptySubsequences: true) {
      guard let r = c.string.range(of: part, range: i..<c.string.endIndex) else { break }
      i = r.upperBound
      if let wb = try? c.boundingBox(for: r)?.boundingBox {
        words.append([(roi.minX + wb.minX * roi.width) * box.width, (roi.minX + wb.maxX * roi.width) * box.width])
      } else { words.append([]) }
    }
    out.append(["x": x * box.width, "y": y * box.height, "w": b.width * roi.width * box.width,
                "h": b.height * roi.height * box.height, "text": c.string, "conf": c.confidence, "words": words])
  }
  return out
}

// true when two line boxes share a meaningful part of the smaller one
func overlaps(_ a: [String: Any], _ b: [String: Any]) -> Bool {
  let ax = a["x"] as! CGFloat, ay = a["y"] as! CGFloat, aw = a["w"] as! CGFloat, ah = a["h"] as! CGFloat
  let bx = b["x"] as! CGFloat, by = b["y"] as! CGFloat, bw = b["w"] as! CGFloat, bh = b["h"] as! CGFloat
  let ix = max(0, min(ax + aw, bx + bw) - max(ax, bx)), iy = max(0, min(ay + ah, by + bh) - max(ay, by))
  return ix * iy > 0.25 * min(aw * ah, bw * bh)
}

for n in 0..<doc.pageCount {
  guard let page = doc.page(at: n) else { continue }
  let box = page.bounds(for: .mediaBox)
  let chars = (page.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines).count
  var out: [String: Any] = ["page": n + 1, "w": box.width, "h": box.height, "text": chars >= 40]
  var lines: [[String: Any]] = []
  if chars < 40 || forceAll || pngDir != nil, let img = render(page, width: renderWidth) {
    if let dir = pngDir {
      let rep = NSBitmapImageRep(cgImage: img)
      try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: "\(dir)/\(n + 1).png"))
    }
    if chars < 40 || forceAll {
      // Pass 1 reads the whole page. Vision sometimes skips lines next to big
      // decorative glyphs (drop numerals), so pass 2 re-reads overlapping
      // vertical strips and keeps only lines that pass 1 did not cover.
      lines = recognize(img, box: box, roi: CGRect(x: 0, y: 0, width: 1, height: 1))
      for roi in [CGRect(x: 0, y: 0, width: 0.38, height: 1), CGRect(x: 0.31, y: 0, width: 0.38, height: 1),
                  CGRect(x: 0.62, y: 0, width: 0.38, height: 1), CGRect(x: 0, y: 0, width: 0.55, height: 1),
                  CGRect(x: 0.45, y: 0, width: 0.55, height: 1)] {
        for l in recognize(img, box: box, roi: roi) where !lines.contains(where: { overlaps($0, l) }) { lines.append(l) }
      }
    }
  }
  out["lines"] = lines
  let data = try! JSONSerialization.data(withJSONObject: out)
  print(String(data: data, encoding: .utf8)!)
}
