// Expo config plugin: prepares the iOS Message Filter (IdentityLookup) extension.
//
// Stages the Swift source from native/ios/MessageFilter into the iOS project.
//
// IMPORTANT (honesty): this does NOT create the Message Filter App Extension
// target or grant its entitlement. The extension needs its own target, the
// com.apple.developer.sms-spam-filter entitlement (requested from Apple), the
// ILMessageFilterExtensionNetworkURL in its Info.plist (the single host it may
// contact), and a provisioning profile. Generate the target with
// @bacons/apple-targets (point it at the staged Swift) and configure signing in
// EAS. The Message Filter does not run on the simulator. See docs/MOBILE.md.
// This cannot be verified in CI without Apple credentials, so it is documented,
// not claimed as proven.

const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = (config) =>
  withDangerousMod(config, [
    "ios",
    (config) => {
      const srcDir = path.join(config.modRequest.projectRoot, "native", "ios", "MessageFilter");
      if (fs.existsSync(srcDir)) {
        const destDir = path.join(
          config.modRequest.platformProjectRoot,
          "Extensions",
          "MessageFilter",
        );
        fs.mkdirSync(destDir, { recursive: true });
        for (const file of fs.readdirSync(srcDir)) {
          fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
        }
      }
      return config;
    },
  ]);
