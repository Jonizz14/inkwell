import AppKit
import ApplicationServices
import CoreAudio

/// Is the microphone in use by anyone? A Continuity call taken on the Mac opens it, and closes it
/// when the call ends. Listened to only around a call (CoreAudio calls back; no polling).
final class Mic {
    var onChange: ((Bool) -> Void)?
    private var device = AudioObjectID(kAudioObjectUnknown)
    private var listening = false
    private var address = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere,
                                                     mScope: kAudioObjectPropertyScopeGlobal,
                                                     mElement: kAudioObjectPropertyElementMain)
    private lazy var block: AudioObjectPropertyListenerBlock = { [weak self] _, _ in
        guard let self else { return }
        let on = self.running
        DispatchQueue.main.async { self.onChange?(on) }
    }

    var running: Bool {
        guard device != kAudioObjectUnknown else { return false }
        var value: UInt32 = 0
        var size = UInt32(MemoryLayout<UInt32>.size)
        var addr = address
        return AudioObjectGetPropertyData(device, &addr, 0, nil, &size, &value) == noErr && value != 0
    }

    func start() {
        guard !listening else { return }
        var addr = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultInputDevice,
                                              mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var size = UInt32(MemoryLayout<AudioObjectID>.size)
        guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &device) == noErr,
              device != kAudioObjectUnknown else { return }
        listening = AudioObjectAddPropertyListenerBlock(device, &address, .main, block) == noErr
    }

    func stop() {
        guard listening else { return }
        AudioObjectRemovePropertyListenerBlock(device, &address, .main, block)
        listening = false
    }
}

/// Answers or declines the call through macOS's own call banner (Notification Center), the way a
/// click on its button would. Needs Accessibility; without it the caller's app is opened instead.
enum CallControl {
    private static let acceptWords = ["accept", "answer", "qabul", "javob", "принять", "ответить"]
    private static let declineWords = ["decline", "reject", "rad et", "отклонить", "сбросить"]

    @discardableResult
    static func press(accept: Bool) -> Bool {
        guard AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true] as CFDictionary) else { return false }
        let words = accept ? acceptWords : declineWords
        for app in NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.notificationcenterui") {
            if find(AXUIElementCreateApplication(app.processIdentifier), words, depth: 0) { return true }
        }
        return false
    }

    private static func string(_ el: AXUIElement, _ attr: String) -> String {
        var value: CFTypeRef?
        AXUIElementCopyAttributeValue(el, attr as CFString, &value)
        return (value as? String ?? "").lowercased()
    }

    private static func find(_ el: AXUIElement, _ words: [String], depth: Int) -> Bool {
        guard depth < 14 else { return false }
        let matches = { (text: String) in words.contains { text.contains($0) } }
        if string(el, kAXRoleAttribute) == (kAXButtonRole as String).lowercased(),
           matches(string(el, kAXTitleAttribute)) || matches(string(el, kAXDescriptionAttribute)) {
            return AXUIElementPerformAction(el, kAXPressAction as CFString) == .success
        }
        // the banner may offer them as named actions instead of buttons
        var names: CFArray?
        if AXUIElementCopyActionNames(el, &names) == .success, let names = names as? [String] {
            for name in names where matches(name.lowercased()) {
                if AXUIElementPerformAction(el, name as CFString) == .success { return true }
            }
        }
        var children: CFTypeRef?
        AXUIElementCopyAttributeValue(el, kAXChildrenAttribute as CFString, &children)
        for child in (children as? [AXUIElement]) ?? [] where find(child, words, depth: depth + 1) { return true }
        return false
    }
}
