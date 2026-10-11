// Local evidence helper: inspects and operates the real packaged WebKit window
// through the macOS accessibility API. No renderer evaluation or fixture bridge.
import AppKit
import ApplicationServices
import Foundation

func attribute(_ element: AXUIElement, _ name: String) -> AnyObject? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
    return value
}
func children(_ element: AXUIElement) -> [AXUIElement] {
    attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? []
}
func describe(_ element: AXUIElement, path: String, depth: Int) -> [[String: Any]] {
    guard depth < 45 else { return [] }
    var record: [String: Any] = ["path": path]
    for name in [kAXRoleAttribute, kAXTitleAttribute, kAXDescriptionAttribute,
                 kAXValueAttribute, kAXHelpAttribute, kAXEnabledAttribute, "AXPlaceholderValue"] {
        if let value = attribute(element, name) {
            if let text = value as? String { record[name] = text }
            else if let number = value as? NSNumber { record[name] = number }
        }
    }
    var actions: CFArray?
    if AXUIElementCopyActionNames(element, &actions) == .success { record["actions"] = actions as? [String] ?? [] }
    var output = [record]
    for (index, child) in children(element).enumerated() {
        output += describe(child, path: path.isEmpty ? String(index) : "\(path).\(index)", depth: depth + 1)
    }
    return output
}
func resolve(_ root: AXUIElement, _ path: String) throws -> AXUIElement {
    var current = root
    for token in path.split(separator: ".") {
        guard let index = Int(token), children(current).indices.contains(index) else { throw NSError(domain: "AXPath", code: 1) }
        current = children(current)[index]
    }
    return current
}
func key(_ code: CGKeyCode, flags: CGEventFlags = []) {
    for down in [true, false] {
        let event = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: down)!
        event.flags = flags
        event.post(tap: .cghidEventTap)
    }
}
let args = CommandLine.arguments
guard args.count >= 3, let pid = Int32(args[1]) else { fatalError("Expected pid dump|press|fill|key [path] [value]") }
guard AXIsProcessTrusted() else { fatalError("Accessibility permission is unavailable") }
let root = AXUIElementCreateApplication(pid)
AXUIElementSetAttributeValue(root, "AXManualAccessibility" as CFString, kCFBooleanTrue)
NSRunningApplication(processIdentifier: pid)?.activate(options: [])
Thread.sleep(forTimeInterval: 0.15)
switch args[2] {
case "windows":
    let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
    let owned = windows.filter { ($0[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value == pid }
    let data = try JSONSerialization.data(withJSONObject: owned, options: [.prettyPrinted, .sortedKeys])
    FileHandle.standardOutput.write(data)
case "dump":
    let records = children(root).enumerated().filter { attribute($0.element, kAXRoleAttribute) as? String == kAXWindowRole }.flatMap { describe($0.element, path: String($0.offset), depth: 0) }
    let data = try JSONSerialization.data(withJSONObject: records, options: [.prettyPrinted, .sortedKeys])
    FileHandle.standardOutput.write(data)
case "press":
    let result = AXUIElementPerformAction(try resolve(root, args[3]), kAXPressAction as CFString)
    guard result == .success else { fatalError("AXPress failed: \(result.rawValue)") }
case "fill":
    let element = try resolve(root, args[3])
    let focus = AXUIElementSetAttributeValue(element, kAXFocusedAttribute as CFString, kCFBooleanTrue)
    guard focus == .success else { fatalError("Focus failed: \(focus.rawValue)") }
    let set = AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, args[4] as CFString)
    guard set == .success else { fatalError("AXValue edit failed: \(set.rawValue)") }
    Thread.sleep(forTimeInterval: 0.1)
case "key":
    guard let code = UInt16(args[3]) else { fatalError("Expected virtual key code") }
    key(code)
default: fatalError("Unknown command")
}
