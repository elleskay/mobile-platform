// Reads the blocked-number set the JS app syncs to disk.
//
// The app writes a JSON array of digit strings to `<filesDir>/blocklist.json`
// (via expo-file-system; see docs/MOBILE.md). This store reads it. Using a shared
// file avoids a custom native bridge: the OS-bound CallScreeningService and the
// JS layer agree on one on-disk source of truth.
//
// The package is rewritten to the app's real package by the
// withAndroidCallScreening config plugin at prebuild time.

package com.elleskay.yourapp.callscreening

import android.content.Context
import org.json.JSONArray
import java.io.File

object BlockedNumberStore {
  private const val FILE_NAME = "blocklist.json"

  fun contains(context: Context, number: String?): Boolean {
    if (number.isNullOrEmpty()) return false
    return load(context).contains(number)
  }

  private fun load(context: Context): Set<String> {
    return try {
      val file = File(context.filesDir, FILE_NAME)
      if (!file.exists()) return emptySet()
      val arr = JSONArray(file.readText())
      val set = HashSet<String>(arr.length())
      for (i in 0 until arr.length()) {
        set.add(arr.getString(i).filter { it.isDigit() })
      }
      set
    } catch (e: Exception) {
      emptySet()
    }
  }
}
