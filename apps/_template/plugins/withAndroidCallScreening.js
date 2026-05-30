// Expo config plugin: wires the Android CallScreeningService into the generated
// native project during `expo prebuild`.
//
//  1. Registers ScamCallScreeningService in AndroidManifest with the
//     BIND_SCREENING_SERVICE permission and the CallScreeningService intent
//     filter, so the OS can bind it when the app holds the call-screening role.
//  2. Copies the Kotlin sources from native/android/callscreening into the app's
//     package, rewriting the placeholder package to the app's real package.
//
// The block decision reads <filesDir>/blocklist.json, which the JS app syncs
// (see docs/MOBILE.md). Proven: prebuild injects the service and the Kotlin
// compiles into the release APK.

const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SUBDIR = "callscreening";
const SERVICE_NAME = ".callscreening.ScamCallScreeningService";
// The placeholder package declared in the reference .kt files; rewritten to the
// app's real package on copy.
const PLACEHOLDER_PKG = "com.elleskay.yourapp";

function addService(androidManifest) {
  const application = androidManifest.manifest.application[0];
  application.service = application.service || [];
  const exists = application.service.some((s) => s.$ && s.$["android:name"] === SERVICE_NAME);
  if (!exists) {
    application.service.push({
      $: {
        "android:name": SERVICE_NAME,
        "android:permission": "android.permission.BIND_SCREENING_SERVICE",
        "android:exported": "true",
      },
      "intent-filter": [
        { action: [{ $: { "android:name": "android.telecom.CallScreeningService" } }] },
      ],
    });
  }
  return androidManifest;
}

const withManifest = (config) =>
  withAndroidManifest(config, (config) => {
    config.modResults = addService(config.modResults);
    return config;
  });

const withKotlinSources = (config) =>
  withDangerousMod(config, [
    "android",
    (config) => {
      const pkg = config.android?.package;
      if (!pkg) throw new Error("withAndroidCallScreening: config.android.package is required");

      const srcDir = path.join(config.modRequest.projectRoot, "native", "android", SUBDIR);
      const destDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        ...pkg.split("."),
        SUBDIR,
      );
      fs.mkdirSync(destDir, { recursive: true });
      for (const file of fs.readdirSync(srcDir)) {
        const source = fs.readFileSync(path.join(srcDir, file), "utf8");
        const rewritten = source.replace(
          new RegExp(`package\\s+${PLACEHOLDER_PKG.replace(/\./g, "\\.")}\\.${SUBDIR}`),
          `package ${pkg}.${SUBDIR}`,
        );
        fs.writeFileSync(path.join(destDir, file), rewritten);
      }
      return config;
    },
  ]);

module.exports = (config) => withKotlinSources(withManifest(config));
