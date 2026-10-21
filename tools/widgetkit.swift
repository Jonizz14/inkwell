// The reader's main process asks WidgetKit for a redraw through this (widgetkit.node, see
// tools/widgetkit.c). Only the app's own process may: a reload from the Reminder helper is
// refused (ChronoCoreErrorDomain 10), and while the reader is in front it costs no budget.
import WidgetKit

@_cdecl("a365_reload")
public func a365_reload(_ kind: UnsafePointer<CChar>?) {
  if let k = kind { WidgetCenter.shared.reloadTimelines(ofKind: String(cString: k)) }
  else { WidgetCenter.shared.reloadAllTimelines() }
}
