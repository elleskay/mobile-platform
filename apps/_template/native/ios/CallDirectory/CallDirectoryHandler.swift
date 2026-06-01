// CallKit Call Directory extension. Reference implementation.
//
// This is an iOS App Extension target, separate from the main app. It supplies
// blocked and identified numbers to the system; iOS calls it out of process.
// JavaScript cannot do this. The app writes the number set to a shared App
// Group container; this extension reads it and hands it to CallKit.
//
// Wiring (handled by the withIosCallDirectory config plugin):
//  - Adds a Call Directory Extension target.
//  - Adds the App Group entitlement (group.com.elleskay.yourapp) to both the
//    app and this extension so they share the number store.
//  - Enables the extension in Settings > Phone > Call Blocking & Identification.

import CallKit
import Foundation

class CallDirectoryHandler: CXCallDirectoryProvider {
  private let appGroup = "group.com.elleskay.yourapp"

  override func beginRequest(with context: CXCallDirectoryExtensionContext) {
    context.delegate = self

    // Numbers must be added in ascending numerical order, per CallKit.
    for entry in loadBlockedNumbers() {
      context.addBlockingEntry(withNextSequentialPhoneNumber: entry)
    }
    for (number, label) in loadIdentifiedNumbers() {
      context.addIdentificationEntry(
        withNextSequentialPhoneNumber: number,
        label: label
      )
    }

    context.completeRequest()
  }

  /// Reads the blocked set the JS app wrote to the shared App Group container.
  private func loadBlockedNumbers() -> [CXCallDirectoryPhoneNumber] {
    guard
      let defaults = UserDefaults(suiteName: appGroup),
      let raw = defaults.array(forKey: "blockedNumbers") as? [NSNumber]
    else { return [] }
    return raw.map { $0.int64Value }.sorted()
  }

  private func loadIdentifiedNumbers() -> [(CXCallDirectoryPhoneNumber, String)] {
    guard
      let defaults = UserDefaults(suiteName: appGroup),
      let raw = defaults.dictionary(forKey: "identifiedNumbers") as? [String: String]
    else { return [] }
    return raw
      .compactMap { key, label in
        Int64(key).map { ($0, label) }
      }
      .sorted { $0.0 < $1.0 }
  }
}

extension CallDirectoryHandler: CXCallDirectoryExtensionContextDelegate {
  func requestFailed(
    for extensionContext: CXCallDirectoryExtensionContext,
    withError error: Error
  ) {
    // Surface to the host app on next launch via the shared container if needed.
    NSLog("CallDirectory request failed: \(error.localizedDescription)")
  }
}
