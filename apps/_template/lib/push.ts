import Constants from "expo-constants";

// Expo push registration. No-ops cleanly when there is no EAS project id, so the
// app runs in dev and tests without a push backend. APNs/FCM live under Expo's
// push service; the API sends to the Expo push endpoint with the token below.
export async function registerForPush(): Promise<string | null> {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) {
    // Not configured. Nothing to register; callers treat null as "push off".
    return null;
  }

  // Lazy-import so the dependency is optional in environments without it.
  const Notifications = await import("expo-notifications");
  const Device = await import("expo-device");

  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return null;

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}
