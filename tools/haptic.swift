// Trackpad taps for the reader (haptic.node, see tools/haptic.c). macOS plays them only while a
// finger rests on a Force Touch trackpad, so they suit drags, scrolls and snaps, not keystrokes.
import AppKit

@_cdecl("a365_haptic")
public func a365_haptic(_ kind: Int32) {
  let p: NSHapticFeedbackManager.FeedbackPattern = kind == 1 ? .levelChange : kind == 2 ? .generic : .alignment
  NSHapticFeedbackManager.defaultPerformer.perform(p, performanceTime: .now)
}
