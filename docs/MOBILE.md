# Mobile runbook

Everything specific to building, signing, and shipping the Expo app, plus the
native call/SMS extensions that JavaScript cannot implement.

## Why native extensions

The signature features (call blocking/identification, SMS filtering) are OS
extension points. The system, not the app, invokes them, out of process:

| Feature | iOS | Android |
|---|---|---|
| Call block / identify | Call Directory Extension (CallKit) | `CallScreeningService` + call-screening role |
| SMS filtering | `ILMessageFilterExtension` (IdentityLookup) | default-SMS role / SMS handling |
| Live caller lookup (optional) | Live Caller ID Lookup (iOS 18) | n/a |

The JS app manages data (block lists, reports, settings) and writes the shared
state the extensions read (iOS App Group container; Android local store). The
reference implementations are in `apps/_template/native/`.

## How the native code gets in

1. Expo managed workflow. You do not commit `ios/` or `android/`.
2. `app.config.ts` lists local config plugins (`withIosCallDirectory`,
   `withIosMessageFilter`, `withAndroidCallScreening`).
3. `expo prebuild` runs the plugins, which:
   - add the extension targets,
   - copy the Swift/Kotlin from `native/` into the generated projects,
   - add entitlements (App Group, `com.apple.developer.sms-spam-filter`) and
     manifest entries (`BIND_SCREENING_SERVICE`, intent filters, permissions).
4. EAS builds the prebuilt project.

Do not hand-edit the generated native projects; prebuild regenerates them.

## EAS setup

```bash
npm i -g eas-cli
eas login
eas init                  # creates the EAS project, writes the project id
eas build:configure       # creates eas.json with build profiles
```

Set `EXPO_TOKEN` as a GitHub secret for the CI build workflow. Set
`EXPO_PUBLIC_API_URL` (build-time, public) to the deployed API URL.

## Credentials

The iOS extensions each need their own App ID and provisioning profile, plus the
App Group shared with the main app, and the SMS-spam-filter entitlement (request
from Apple). Manage with `eas credentials`. Android needs the call-screening role
declared and requested at runtime; no special signing beyond the app keystore EAS
manages.

## Build vs OTA

- New native capability (permission, extension, native dep): full `eas build`,
  then store submit. OTA cannot ship native changes.
- JS/asset-only change: `eas update` to the channel. Instant, no review.

## Store review notes

- Call/SMS filtering features draw extra scrutiny. Document the legitimate
  anti-scam use and provide a test account/walkthrough in App Store / Play
  review notes.
- iOS: the Message Filter network path may only contact the single host declared
  in the extension's Info.plist; no analytics or logging of message content.
- Android: holding the default-SMS or call-screening role has Play policy
  requirements; declare the core use case.

## Testing on device

The spec gate runs Detox on a simulator/emulator, which does not exercise the
real call/SMS interception. Before any release, verify on a physical device that
the extensions are enabled (iOS Settings > Phone / Messages, Android default-apps)
and actually intercept. This is the journey check the gate cannot do (see
`docs/TESTING.md`).
