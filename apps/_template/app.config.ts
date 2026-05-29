import type { ExpoConfig } from "expo/config";

// Real-app Expo config. Copy to apps/app/, rename, set the real bundle ids and
// EAS project id. The native call/SMS extensions are wired by the config plugins
// listed below; they copy the Swift/Kotlin under native/ into the prebuilt
// projects and add the entitlements + manifest entries. See docs/MOBILE.md.
const config: ExpoConfig = {
  name: "your-app",
  slug: "your-app",
  version: "0.1.0",
  scheme: "yourapp",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    bundleIdentifier: "com.elleskay.yourapp",
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    // App Transport Security: TLS only. Do not add NSAllowsArbitraryLoads.
  },
  android: {
    package: "com.elleskay.yourapp",
    usesCleartextTraffic: false,
    permissions: [
      "android.permission.READ_PHONE_STATE",
      "android.permission.ANSWER_PHONE_CALLS",
      "android.permission.RECEIVE_SMS",
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    // Local config plugins that inject the native extensions at prebuild time.
    // Each is a function exported from ./plugins that mutates the native project.
    "./plugins/withIosCallDirectory",
    "./plugins/withIosMessageFilter",
    "./plugins/withAndroidCallScreening",
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
