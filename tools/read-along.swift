// Read-along listener for the reader: streams the microphone through Apple's speech recogniser
// and prints one JSON object per line on stdout:
//   {"t":"ready","engine":"analyzer"}       listening started
//   {"t":"loading"}                         first run: the on-device speech model is downloading
//   {"t":"text","seg":3,"text":"…"}         running transcript of the current segment (revised as it goes)
//   {"t":"level","v":0.42}                  input loudness 0…1, ~10× a second
//   {"t":"error","code":"denied","msg":"…"} fatal; the process exits after it
//
// Two engines:
//   analyzer (macOS 26+): SpeechAnalyzer + DictationTranscriber, on-device, volatile results, and
//     it takes the article's words as hints. Measured on a 46 s accented passage it matched the
//     server model (4.2% word errors, same speed) without the network; SpeechTranscriber
//     (READ_ALONG_MODULE=speech) ignores the hints and was slower (5.0%, +0.2 s).
//     A segment is one finalised stretch of speech.
//   legacy: SFSpeechRecognizer (Apple's server model, on-device when offline). A segment ends when
//     the recogniser finishes or gives up; the next one starts at once on the same audio stream.
// READ_ALONG_ENGINE=legacy forces the old one. If the analyzer can't start, legacy takes over.
// READ_ALONG_CTX (env, JSON array) biases recognition towards the article's words; stdin "stop" ends.
// Build: swiftc -O tools/read-along.swift -o src/bin/read-along
// Test without a microphone: read-along --file speech.aiff [locale]
//   plays the file in real time through the same path as the microphone; text events then carry
//   "ms", the time since the audio started, to compare how fast each engine keeps up.
import AVFoundation
import Foundation
import Speech

setvbuf(stdout, nil, _IOLBF, 0)

let emitLock = NSLock()
func emit(_ obj: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: obj), let line = String(data: data, encoding: .utf8) else { return }
  emitLock.lock()
  print(line)
  fflush(stdout)
  emitLock.unlock()
}

func fail(_ code: String, _ msg: String) -> Never {
  emit(["t": "error", "code": code, "msg": msg])
  exit(1)
}

var args = Array(CommandLine.arguments.dropFirst())
var filePath: String?
if let i = args.firstIndex(of: "--file"), i + 1 < args.count {
  filePath = args[i + 1]
  args.removeSubrange(i...(i + 1))
}
let locale = Locale(identifier: args.first ?? "en-US")
let env = ProcessInfo.processInfo.environment
let context: [String] = {
  guard let s = env["READ_ALONG_CTX"], let d = s.data(using: .utf8),
        let w = try? JSONSerialization.jsonObject(with: d) as? [String] else { return [] }
  return Array(w.prefix(100))
}()

let lock = NSLock()
func locked<T>(_ body: () -> T) -> T {
  lock.lock()
  defer { lock.unlock() }
  return body()
}
var seg = 0
var stopping = false
var started = Date()
func textEvent(_ seg: Int, _ text: String) {
  var m: [String: Any] = ["t": "text", "seg": seg, "text": text]
  if filePath != nil { m["ms"] = Int(Date().timeIntervalSince(started) * 1000) }
  emit(m)
}

/* ---------------- audio: microphone, or a file played in real time ---------------- */

// whichever engine runs sets this; it gets every buffer in the input's own format
var sink: (AVAudioPCMBuffer) -> Void = { _ in }
let engine = AVAudioEngine()
var lastLevel = Date.distantPast

func level(_ buffer: AVAudioPCMBuffer) {
  let now = Date()
  guard now.timeIntervalSince(lastLevel) > 0.09, let ch = buffer.floatChannelData?[0] else { return }
  lastLevel = now
  let n = Int(buffer.frameLength)
  var sum: Float = 0
  for i in 0..<n { sum += ch[i] * ch[i] }
  let rms = n > 0 ? sqrt(sum / Float(n)) : 0
  let db = 20 * log10(max(rms, 1e-6))
  emit(["t": "level", "v": Double(max(0, min(1, (db + 55) / 45)))])
}

func inputFormat() -> AVAudioFormat {
  if let path = filePath {
    guard let f = try? AVAudioFile(forReading: URL(fileURLWithPath: path)) else { fail("file", "Cannot read \(path)") }
    return f.processingFormat
  }
  let format = engine.inputNode.outputFormat(forBus: 0)
  guard format.sampleRate > 0, format.channelCount > 0 else { fail("nomic", "No microphone input") }
  return format
}

func startAudio(onEnd: @escaping () -> Void) {
  started = Date()
  if let path = filePath {
    Thread.detachNewThread {
      guard let f = try? AVAudioFile(forReading: URL(fileURLWithPath: path)) else { fail("file", "Cannot read \(path)") }
      let chunk: AVAudioFrameCount = 1024
      var fed = 0.0
      while true {
        guard let buf = AVAudioPCMBuffer(pcmFormat: f.processingFormat, frameCapacity: chunk) else { break }
        do { try f.read(into: buf, frameCount: chunk) } catch { break }
        if buf.frameLength == 0 { break }
        sink(buf)
        fed += Double(buf.frameLength) / f.processingFormat.sampleRate
        let ahead = fed - Date().timeIntervalSince(started)
        if ahead > 0 { Thread.sleep(forTimeInterval: ahead) }
      }
      onEnd()
    }
    return
  }
  engine.inputNode.installTap(onBus: 0, bufferSize: 1024, format: inputFormat()) { buffer, _ in
    sink(buffer)
    level(buffer)
  }
  engine.prepare()
  do { try engine.start() } catch { fail("nomic", error.localizedDescription) }
}

/* ---------------- engine 1: SpeechAnalyzer (macOS 26+) ---------------- */

@available(macOS 26, *)
func startAnalyzer() async throws {
  let dictation = env["READ_ALONG_MODULE"] != "speech"
  let transcriber: any SpeechModule
  if dictation {
    guard let loc = await DictationTranscriber.supportedLocale(equivalentTo: locale) else {
      throw NSError(domain: "read-along", code: 1, userInfo: [NSLocalizedDescriptionKey: "DictationTranscriber unavailable for \(locale.identifier)"])
    }
    transcriber = DictationTranscriber(locale: loc, contentHints: [], transcriptionOptions: [], reportingOptions: [.volatileResults, .frequentFinalization], attributeOptions: [])
  } else {
    guard SpeechTranscriber.isAvailable, let loc = await SpeechTranscriber.supportedLocale(equivalentTo: locale) else {
      throw NSError(domain: "read-along", code: 1, userInfo: [NSLocalizedDescriptionKey: "SpeechTranscriber unavailable for \(locale.identifier)"])
    }
    // fast + volatile: a first guess for each word right away, refined as more audio comes in
    transcriber = SpeechTranscriber(locale: loc, transcriptionOptions: [], reportingOptions: [.volatileResults, .fastResults], attributeOptions: [])
  }
  if let install = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
    emit(["t": "loading"])
    try await install.downloadAndInstall()
  }
  let input = inputFormat()
  guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber], considering: input) else {
    throw NSError(domain: "read-along", code: 2, userInfo: [NSLocalizedDescriptionKey: "No audio format"])
  }
  let analyzer = SpeechAnalyzer(modules: [transcriber], options: .init(priority: .userInitiated, modelRetention: .processLifetime))
  if !context.isEmpty {
    let ctx = AnalysisContext()
    ctx.contextualStrings[.general] = context
    try? await analyzer.setContext(ctx)
  }
  try await analyzer.prepareToAnalyze(in: format)

  // one converter for the whole stream, so resampling stays continuous between buffers
  let converter = input == format ? nil : AVAudioConverter(from: input, to: format)
  let (stream, feed) = AsyncStream<AnalyzerInput>.makeStream(bufferingPolicy: .unbounded)
  sink = { buf in
    guard let conv = converter else { feed.yield(AnalyzerInput(buffer: buf)); return }
    let cap = AVAudioFrameCount(Double(buf.frameLength) * format.sampleRate / buf.format.sampleRate + 32)
    guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: cap) else { return }
    var given = false
    var err: NSError?
    conv.convert(to: out, error: &err) { _, status in
      if given { status.pointee = .noDataNow; return nil }
      given = true
      status.pointee = .haveData
      return buf
    }
    if err == nil && out.frameLength > 0 { feed.yield(AnalyzerInput(buffer: out)) }
  }

  locked { seg = 1 }
  // a result covers the speech after the last final one: volatile ones are replaced as the
  // model firms up, a final one closes the segment and the next result starts a new one
  // returns false once read-along is stopping
  @Sendable func onResult(_ text: AttributedString, _ isFinal: Bool) -> Bool {
    let (mine, quit) = locked { () -> (Int, Bool) in
      defer { if isFinal { seg += 1 } }
      return (seg, stopping)
    }
    if quit { return false }
    let s = String(text.characters).trimmingCharacters(in: .whitespacesAndNewlines)
    if !s.isEmpty { textEvent(mine, s) }
    return true
  }
  Task {
    do {
      if let t = transcriber as? SpeechTranscriber {
        for try await r in t.results { if !onResult(r.text, r.isFinal) { break } }
      } else if let t = transcriber as? DictationTranscriber {
        for try await r in t.results { if !onResult(r.text, r.isFinal) { break } }
      }
    } catch {
      fail("recognizer", error.localizedDescription)
    }
    if filePath != nil { exit(0) }
  }
  try await analyzer.start(inputSequence: stream)
  startAudio {
    feed.finish()
    Task { try? await analyzer.finalizeAndFinishThroughEndOfInput() }
  }
  emit(["t": "ready", "engine": dictation ? "dictation" : "analyzer"])
}

/* ---------------- engine 2: SFSpeechRecognizer ---------------- */

var request: SFSpeechAudioBufferRecognitionRequest?
var task: SFSpeechRecognitionTask?
var failures: [Date] = []
var useDevice = false // switched on when the server can't be reached

func startLegacy() {
  guard let recognizer = SFSpeechRecognizer(locale: locale) else { fail("locale", "Speech recognition does not support \(locale.identifier)") }
  let onDevice = recognizer.supportsOnDeviceRecognition

  func configure(_ req: SFSpeechRecognitionRequest) {
    req.shouldReportPartialResults = true
    req.taskHint = .dictation
    if useDevice { req.requiresOnDeviceRecognition = true }
    if #available(macOS 13, *) { req.addsPunctuation = false }
    req.contextualStrings = context
  }

  // a fresh request takes over the audio first, then the old one is let go
  func startSegment() {
    lock.lock()
    seg += 1
    let mine = seg
    let req = SFSpeechAudioBufferRecognitionRequest()
    configure(req)
    let old = (request, task)
    request = req
    lock.unlock()
    old.0?.endAudio()
    old.1?.cancel()
    let t = recognizer.recognitionTask(with: req) { result, error in
      lock.lock()
      let current = mine == seg && !stopping
      lock.unlock()
      guard current else { return }
      if let r = result {
        textEvent(mine, r.bestTranscription.formattedString)
        if r.isFinal { DispatchQueue.main.async { startSegment() } }
        return
      }
      if let e = error as NSError? {
        // silence and time limits end a segment quietly; many errors in a row mean it can't work
        let now = Date()
        failures = failures.filter { now.timeIntervalSince($0) < 10 } + [now]
        // the server keeps failing (offline, blocked): carry on with the on-device model
        if failures.count >= 2 && onDevice && !useDevice { useDevice = true; failures = [] }
        if failures.count >= 6 { fail("recognizer", e.localizedDescription) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { startSegment() }
      }
    }
    lock.lock()
    task = t
    lock.unlock()
  }

  sink = { buf in
    lock.lock()
    let req = request
    lock.unlock()
    req?.append(buf)
  }
  startSegment()
  startAudio {
    // file test: let the last segment finish, then quit
    lock.lock()
    let req = request
    request = nil
    lock.unlock()
    req?.endAudio()
    DispatchQueue.main.asyncAfter(deadline: .now() + 8) { exit(0) }
  }
  emit(["t": "ready", "engine": "legacy"])
}

/* ---------------- start ---------------- */

func listen() {
  if env["READ_ALONG_ENGINE"] != "legacy", #available(macOS 26, *) {
    Task {
      do { try await startAnalyzer() } catch {
        // no model for this language, download refused, …: the old engine still works
        DispatchQueue.main.async { startLegacy() }
      }
    }
  } else {
    startLegacy()
  }
}

// stdin commands (not in file mode)
if filePath == nil { DispatchQueue.global().async {
  while let line = readLine() {
    if line == "stop" { break }
  }
  // stdin closed or "stop": the app is done with us
  lock.lock()
  stopping = true
  lock.unlock()
  engine.stop()
  exit(0)
} }

SFSpeechRecognizer.requestAuthorization { status in
  guard status == .authorized else {
    fail(status == .restricted ? "restricted" : "denied", "Speech recognition permission: \(status.rawValue)")
  }
  if filePath != nil { return DispatchQueue.main.async { listen() } }
  switch AVCaptureDevice.authorizationStatus(for: .audio) {
  case .authorized: DispatchQueue.main.async { listen() }
  case .notDetermined:
    AVCaptureDevice.requestAccess(for: .audio) { ok in
      if ok { DispatchQueue.main.async { listen() } } else { fail("mic", "Microphone permission denied") }
    }
  default: fail("mic", "Microphone permission denied")
  }
}

dispatchMain()
