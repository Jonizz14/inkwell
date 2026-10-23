// Reminder banners for the reader. Electron 38 still posts through NSUserNotification, which
// current macOS drops without a word, so notify.js hands the banner to this helper instead.
// It must sit in the app's own Contents/MacOS (scripts/build-remind.sh puts it there and signs
// the app again): UNUserNotificationCenter takes the bundle a process lives in as its sender,
// so the banner comes from "Inkwell" with its icon, and a click brings the reader up.
// The reader starts it itself, so macOS asks "allow notifications?" on the reader's behalf.
//
//   Reminder --title T --body B [--image png] [--id ID]
//       asks for permission the first time, posts the banner, prints {"ok":true} or
//       {"ok":false,"err":"…","code":1} (code 1 = notifications are off for the app) and exits.
//   Reminder --delivered ID
//       prints {"ok":true,"there":bool}: is that banner still in Notification Center? A click
//       takes it away, so the reader tells a click on it from an ordinary start by this.
import Foundation
import UserNotifications
import WidgetKit

setvbuf(stdout, nil, _IOLBF, 0)

func arg(_ name: String) -> String? {
  let a = CommandLine.arguments
  guard let i = a.firstIndex(of: name), i + 1 < a.count else { return nil }
  return a[i + 1]
}
func finish(_ obj: [String: Any]) -> Never {
  if let d = try? JSONSerialization.data(withJSONObject: obj), let s = String(data: d, encoding: .utf8) { print(s) }
  exit(obj["ok"] as? Bool == true ? 0 : 1)
}

// Reminder --reload: widget.json changed, redraw the widget (only the app's own bundle may ask)
if CommandLine.arguments.contains("--reload") {
  WidgetCenter.shared.reloadAllTimelines()
  DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { finish(["ok": true]) }
  dispatchMain()
}

let center = UNUserNotificationCenter.current()

if let id = arg("--delivered") {
  center.getDeliveredNotifications { list in
    finish(["ok": true, "there": list.contains { $0.request.identifier == id }])
  }
  DispatchQueue.main.asyncAfter(deadline: .now() + 5) { finish(["ok": false, "err": "timeout"]) }
  dispatchMain()
}

center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, err in
  guard granted else { finish(["ok": false, "err": err?.localizedDescription ?? "denied", "code": (err as NSError?)?.code ?? 1]) }
  let c = UNMutableNotificationContent()
  c.title = arg("--title") ?? "Inkwell"
  c.body = arg("--body") ?? ""
  c.sound = .default
  c.threadIdentifier = "remind"
  if let img = arg("--image") {
    // the attachment is moved into the system's store, so hand over a copy
    let tmp = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(UUID().uuidString + ".png")
    if (try? FileManager.default.copyItem(at: URL(fileURLWithPath: img), to: tmp)) != nil,
      let a = try? UNNotificationAttachment(identifier: "img", url: tmp, options: nil)
    {
      c.attachments = [a]
    }
  }
  center.add(UNNotificationRequest(identifier: arg("--id") ?? UUID().uuidString, content: c, trigger: nil)) { err in
    if let err = err { finish(["ok": false, "err": err.localizedDescription, "code": (err as NSError).code]) }
    finish(["ok": true])
  }
}
DispatchQueue.main.asyncAfter(deadline: .now() + 120) { finish(["ok": false, "err": "timeout"]) }
dispatchMain()
