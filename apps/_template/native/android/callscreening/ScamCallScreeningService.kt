// Android call screening. Reference implementation.
//
// CallScreeningService lets the app screen incoming calls before they ring. The
// app must hold the call-screening role (RoleManager.ROLE_CALL_SCREENING),
// which the user grants once. JavaScript cannot screen calls; the OS binds to
// this service. The blocked-number set is read from the same local store the JS
// app writes (Room/SharedPreferences via a small bridge).
//
// Wiring (withAndroidCallScreening config plugin): registers this service in
// AndroidManifest with the BIND_SCREENING_SERVICE permission and intent filter,
// and adds the role-request flow.

package com.elleskay.yourapp.callscreening

import android.telecom.Call
import android.telecom.CallScreeningService

class ScamCallScreeningService : CallScreeningService() {

  override fun onScreenCall(callDetails: Call.Details) {
    val number = callDetails.handle?.schemeSpecificPart?.normalizeDigits()
    val decision = classify(number)

    val response = CallResponse.Builder()
      .setDisallowCall(decision.block)
      .setRejectCall(decision.block)
      .setSkipCallLog(false)
      .setSkipNotification(decision.block)
      .build()

    respondToCall(callDetails, response)
  }

  private data class Decision(val block: Boolean)

  private fun classify(number: String?): Decision {
    if (number == null) return Decision(block = false)
    return Decision(block = BlockedNumberStore.contains(this, number))
  }

  private fun String.normalizeDigits(): String = filter { it.isDigit() }
}
