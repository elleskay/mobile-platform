import * as SecureStore from "expo-secure-store";

// Access tokens are short-lived JWTs issued by the NestJS API. They live in the
// device keychain/keystore via expo-secure-store, never in AsyncStorage and
// never in the JS bundle. Refresh server-side.
const ACCESS_TOKEN_KEY = "access_token";

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function clearAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}
