// SMS / MMS filtering via IdentityLookup. Reference implementation.
//
// ILMessageFilterExtension is an iOS App Extension. iOS hands it the text of
// messages from unknown senders and the extension classifies them into the
// Junk / Promotion / Transaction folders. It can optionally defer to a network
// service (your NestJS API) for messages it cannot classify offline.
//
// Constraints to respect:
//  - The offline path must be deterministic and fast; iOS budgets it tightly.
//  - The network path may only contact the single host declared in the
//    extension's Info.plist (ILMessageFilterExtensionNetworkURL).
//  - No user content is logged. The extension cannot read prior messages.
//
// Wiring (withIosMessageFilter config plugin): adds the Message Filter target,
// the com.apple.developer.sms-spam-filter entitlement, and the network URL.

import IdentityLookup
import Foundation

final class MessageFilterExtension: ILMessageFilterExtension {}

extension MessageFilterExtension: ILMessageFilterQueryHandling {
  func handle(
    _ queryRequest: ILMessageFilterQueryRequest,
    context: ILMessageFilterExtensionContext,
    completion: @escaping (ILMessageFilterQueryResponse) -> Void
  ) {
    let (offlineAction, offlineSubAction) = offlineClassification(for: queryRequest)

    switch offlineAction {
    case .none:
      // Inconclusive offline. Defer to the network service if configured.
      context.deferQueryRequestToNetwork { networkResponse, error in
        let response = ILMessageFilterQueryResponse()
        if let networkResponse, error == nil {
          response.action = self.action(fromStatus: networkResponse.httpResponse?.statusCode)
        } else {
          response.action = .none
        }
        completion(response)
      }
    default:
      let response = ILMessageFilterQueryResponse()
      response.action = offlineAction
      response.subAction = offlineSubAction
      completion(response)
    }
  }

  /// Deterministic offline pass. Mirrors the API's cheap heuristic so obvious
  /// scams are caught without a round trip.
  private func offlineClassification(
    for request: ILMessageFilterQueryRequest
  ) -> (ILMessageFilterAction, ILMessageFilterSubAction) {
    let body = (request.messageBody ?? "").lowercased()
    let hasLink = body.contains("http://") || body.contains("https://") || body.contains("www.")
    let lure = ["verify", "urgent", "prize", "otp", "password", "bank", "click"]
      .contains { body.contains($0) }
    if hasLink && lure {
      return (.filter, .promotionalOthers)
    }
    return (.none, .none)
  }

  private func action(fromStatus status: Int?) -> ILMessageFilterAction {
    guard let status else { return .none }
    return (200..<300).contains(status) ? .filter : .allow
  }
}
