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
2. `app.config.ts` lists local config plugins in `apps/_template/plugins/`
   (`withIosCallDirectory`, `withIosMessageFilter`, `withAndroidCallScreening`).
3. `expo prebuild` runs the plugins:
   - **Android (proven):** `withAndroidCallScreening` registers
     `ScamCallScreeningService` in the manifest (`BIND_SCREENING_SERVICE` + intent
     filter) and copies the Kotlin into the app package (rewriting the package
     name). This is verified end to end: the service appears in the generated
     manifest and compiles into the release APK.
   - **iOS (partial):** `withIosCallDirectory` / `withIosMessageFilter` add the
     App Group entitlement and stage the Swift under `ios/Extensions/`. They do
     **not** create the Call Directory / Message Filter App Extension *targets* —
     that needs `@bacons/apple-targets` (point it at the staged Swift) plus an
     Apple Developer account for the per-extension App IDs, App Group, the
     `com.apple.developer.sms-spam-filter` entitlement, and provisioning profiles.
4. EAS builds the prebuilt project (after you have generated the iOS targets).

The Android block decision reads `<filesDir>/blocklist.json`. The JS app keeps it
current by fetching the scam-number list and writing that file with
`expo-file-system` (documentDirectory maps to filesDir); iOS writes the same set
to the App Group `UserDefaults`. Using a shared file/container means **no custom
native bridge** is needed for the data path.

Do not hand-edit the generated native projects; prebuild regenerates them.

## Local builds (prerequisites)

EAS builds in the cloud, so day-to-day you do not need a local toolchain. But for
a local Android build (e.g. `cd android && ./gradlew assembleRelease` to install a
release APK on an emulator for the on-device checks below), the **Android Gradle
Plugin requires JDK 17+** (Gradle/AGP 8.x). With Java 11 the build fails fast with
`Android Gradle plugin requires Java 17 to run`. Point `JAVA_HOME` at a 17+ JDK,
e.g. Android Studio's bundled runtime:

```bash
# Windows (Android Studio JBR is JDK 21, which AGP accepts)
JAVA_HOME="C:\Program Files\Android\Android Studio\jbr" ./gradlew.bat assembleRelease
```

CI does not hit this because the mobile build runs on EAS; if you add a local
Gradle step to a workflow, pin `actions/setup-java` to temurin 17.

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

## Web demo (clickable preview on GitHub Pages)

Expo can export the app for web (react-native-web), which makes a zero-cost,
clickable demo: a browser URL running the real screens against the live API.
Native-only features (background GPS, push, microphone capture) degrade
gracefully on web; auth, lists, forms, and API-backed screens work.

`apps/_demo` is wired up as the reference. To add it to an app:

1. **Web deps:** `npx expo install react-dom react-native-web @expo/metro-runtime`.
2. **Web config** in `app.json`: `"web": { "bundler": "metro", "output": "single" }`
   and `"experiments": { "baseUrl": "/<repo-name>" }` (Pages serves under the repo
   path; omit only if you use a custom root domain).
3. **Web-safe storage:** use `lib/secure-storage.ts` (localStorage on web, SecureStore
   on native) instead of calling `expo-secure-store` directly. `expo-secure-store`
   has no web implementation and throws, which silently hangs an auth gate on web.
4. **Guard native-only calls** behind `Platform.OS !== "web"` (for example
   `TaskManager.defineTask`, `Location.startLocationUpdatesAsync`), and keep
   `Device.isDevice` checks on push registration.
5. **Phone framing:** wrap the root layout in `DeviceFrame` (see
   `apps/_demo/components/DeviceFrame.tsx`) so the web build reads as a phone
   instead of stretching full-window. No-op on native.
6. **Enable the workflow:** set repo variables `WEB_DEMO=true`, `DEMO_API_URL`
   (the live API base), and optionally `APP_DIR` if your app is not `apps/_demo`.
   The `deploy-web` workflow exports and publishes to Pages on push to `main`
   (it auto-enables Pages on first run). It stays inert until `WEB_DEMO=true`.

Local check: `cd apps/<app> && npx expo export --platform web` (CI runs this on
`_demo` to keep the web build healthy). Serve `dist/` under the `/<repo-name>/`
path to test the `baseUrl` locally.

## Store review notes

- Call/SMS filtering features draw extra scrutiny. Document the legitimate
  anti-scam use and provide a test account/walkthrough in App Store / Play
  review notes.
- iOS: the Message Filter network path may only contact the single host declared
  in the extension's Info.plist; no analytics or logging of message content.
- Android: holding the default-SMS or call-screening role has Play policy
  requirements; declare the core use case.

## Testing on device

The spec gate runs Maestro on an emulator, which does not exercise the
real call/SMS interception. Before any release, verify on a physical device that
the extensions are enabled (iOS Settings > Phone / Messages, Android default-apps)
and actually intercept. This is the journey check the gate cannot do (see
`docs/TESTING.md`).
