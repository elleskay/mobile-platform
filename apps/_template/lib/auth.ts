import { secureGet, secureSet, secureDelete } from "./secure-storage";

// Access tokens are short-lived JWTs issued by the NestJS API. On native they
// live in the device keychain/keystore via expo-secure-store; the web build
// falls back to localStorage (see secure-storage.ts). Never in AsyncStorage and
// never in the JS bundle. Refresh server-side.
const ACCESS_TOKEN_KEY = "access_token";

export async function setAccessToken(token: string): Promise<void> {
  await secureSet(ACCESS_TOKEN_KEY, token);
}

export async function getAccessToken(): Promise<string | null> {
  return secureGet(ACCESS_TOKEN_KEY);
}

export async function clearAccessToken(): Promise<void> {
  await secureDelete(ACCESS_TOKEN_KEY);
}
