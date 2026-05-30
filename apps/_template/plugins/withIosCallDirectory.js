// Expo config plugin: prepares the iOS CallKit Call Directory extension.
//
// Adds the App Group entitlement (group.<bundleId>) to the app so the app and
// the extension can share the blocked-number container, and stages the Swift
// source from native/ios/CallDirectory into the iOS project.
//
// IMPORTANT (honesty): this does NOT create the Call Directory App Extension
// target. Apple extension targets require manipulating the Xcode project and, to
// run on a device, an Apple Developer account with a separate App ID, the App
// Group, and a provisioning profile for the extension. Generate the target with
// @bacons/apple-targets (point it at the staged Swift) and configure signing in
// EAS. Keep the App Group constant in CallDirectoryHandler.swift in sync with
// the bundle id below. See docs/MOBILE.md. This cannot be verified in CI without
// Apple credentials, so it is documented, not claimed as proven.

const { withEntitlementsPlist, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withAppGroup = (config) =>
  withEntitlementsPlist(config, (config) => {
    const bundleId = config.ios?.bundleIdentifier;
    if (!bundleId) return config;
    const group = `group.${bundleId}`;
    const key = "com.apple.security.application-groups";
    const groups = config.modResults[key] || [];
    if (!groups.includes(group)) groups.push(group);
    config.modResults[key] = groups;
    return config;
  });

const withSwiftSource = (config) =>
  withDangerousMod(config, [
    "ios",
    (config) => {
      const srcDir = path.join(config.modRequest.projectRoot, "native", "ios", "CallDirectory");
      if (fs.existsSync(srcDir)) {
        const destDir = path.join(
          config.modRequest.platformProjectRoot,
          "Extensions",
          "CallDirectory",
        );
        fs.mkdirSync(destDir, { recursive: true });
        for (const file of fs.readdirSync(srcDir)) {
          fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
        }
      }
      return config;
    },
  ]);

module.exports = (config) => withSwiftSource(withAppGroup(config));
