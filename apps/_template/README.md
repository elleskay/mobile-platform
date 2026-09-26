# apps/\_template

Overlay for a real Expo app, not a runnable app on its own. Copy what you need onto `apps/app/` (a copy of `apps/_demo`); `docs/SETUP.md` has the steps.

## What's here

- `app.config.ts` - Expo config: bundle ids, permissions, cleartext off, and the three native config plugins.
- `eas.json` - EAS build and submit profiles.
- `plugins/` - config plugins that copy `native/` into the generated `ios/` and `android/` projects at prebuild.
- `native/ios/CallDirectory/` - CallKit Call Directory extension (Swift) reference for call blocking/identification.
- `native/ios/MessageFilter/` - `ILMessageFilterExtension` (Swift) reference for SMS filtering.
- `native/android/callscreening/` - `CallScreeningService` plus the blocklist store it reads (Kotlin) reference.
- `lib/` - typed API client (`api.ts`), access-token storage (`auth.ts` over `secure-storage.ts`, which falls back to localStorage on web), Expo push registration (`push.ts`), and the offline heuristic (`classifier.ts`).
- `specs/` - where your `<app>.yml` spec lives.
- `tests/`, `jest.config.js`, `babel.config.js` - jest-expo unit and component layers ([tests/README.md](tests/README.md)).
- `.maestro/` - Maestro e2e flows.
- `verification/` - signed real-device artifacts for `native`/`manual` requirements ([verification/README.md](verification/README.md)).
- `.github/workflows/test.yml` - the app's test workflow: jest, attestations, and Maestro e2e on an Android emulator.

## Native modules: read first

Call blocking and SMS filtering are platform-native app extensions. They cannot be implemented in JavaScript. The JS app manages data (block lists, reports); the OS calls the extensions. See `docs/MOBILE.md` for the full wiring, entitlements, and store-review notes.

The Swift/Kotlin files here are references that the config plugins copy in at prebuild. Android is complete: the plugin registers the service in the manifest and the Kotlin compiles into the APK. iOS is partial: the plugins stage the Swift and add the App Group entitlement, but the extension targets still need `@bacons/apple-targets` and Apple provisioning. Do not hand-edit `ios/` or `android/`; `expo prebuild` regenerates them.
