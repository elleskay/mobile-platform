export interface CheckResult {
  verdict: "scam" | "suspicious" | "clean";
  score: number;
  reason: string;
}

/**
 * Pure offline heuristic, shared between the app UI and the iOS Message Filter
 * extension's offline pass. Keep it deterministic and dependency-free so it can
 * run inside the tightly budgeted extension and in unit tests. The authoritative
 * classifier (LLM-backed) lives server-side in services/api.
 */
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
