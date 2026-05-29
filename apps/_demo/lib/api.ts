import Constants from "expo-constants";

// EXPO_PUBLIC_* vars are inlined into the bundle at build time and are public.
// The API base URL is safe to ship; API keys are not. See CLAUDE.md gotcha #4.
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "http://localhost:3000";

export interface CheckResult {
  verdict: "scam" | "suspicious" | "clean";
  score: number;
  reason: string;
}

/**
 * Calls the NestJS API to classify a message. The platform demo ships a local
 * heuristic fallback so the app is usable (and testable) without a running API.
 */
export async function checkMessage(text: string): Promise<CheckResult> {
  try {
    const res = await fetch(`${API_URL}/reports/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as CheckResult;
  } catch {
    return localHeuristic(text);
  }
}

/** Minimal offline heuristic. The real classifier lives in services/api. */
export function localHeuristic(text: string): CheckResult {
  const t = text.toLowerCase();
  const hasLink = /https?:\/\/|\bwww\./.test(t);
  const lure = /(verify|urgent|prize|gift|otp|password|bank|click)/.test(t);
  if (hasLink && lure)
    return { verdict: "scam", score: 0.9, reason: "Link plus urgency lure." };
  if (hasLink || lure)
    return {
      verdict: "suspicious",
      score: 0.5,
      reason: "Contains a link or pressure language.",
    };
  return { verdict: "clean", score: 0.1, reason: "No common scam markers." };
}
