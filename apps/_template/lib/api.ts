import Constants from "expo-constants";
import { getAccessToken } from "./auth";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Thin authenticated fetch wrapper for the NestJS API. Attaches the device's
 * access token, sends/parses JSON, throws ApiError on non-2xx.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new ApiError(`${init.method ?? "GET"} ${path} -> ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}
