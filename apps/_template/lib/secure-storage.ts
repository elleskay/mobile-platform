import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Key/value secret storage. On native this is the device keychain/keystore via
// expo-secure-store. expo-secure-store has no web implementation (its native
// methods are undefined in a browser and throw), so the web build falls back to
// localStorage. Web storage is not a secure enclave: only use the web target for
// demos/previews, never to hold anything more sensitive than a short-lived JWT.
const opts = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY } as const;

const memory = new Map<string, string>(); // last-resort fallback (no window)

export async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value, opts);
}

export async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      memory.delete(key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
