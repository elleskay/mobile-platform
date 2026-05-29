import { Injectable, Logger } from "@nestjs/common";

export interface Classification {
  verdict: "scam" | "suspicious" | "clean";
  score: number;
  reason: string;
  source: "llm" | "heuristic";
}

/**
 * Scam / phishing classifier. Calls the configured LLM endpoint when available,
 * otherwise falls back to a deterministic heuristic so the API is functional and
 * testable without a model. Mirrors the app's offline heuristic so verdicts are
 * consistent between device and server.
 */
@Injectable()
export class ClassifierService {
  private readonly logger = new Logger(ClassifierService.name);
  private readonly apiUrl = process.env.CLASSIFIER_API_URL;
  private readonly apiKey = process.env.CLASSIFIER_API_KEY;

  async classify(text: string): Promise<Classification> {
    if (this.apiUrl && this.apiKey) {
      try {
        return await this.classifyWithLlm(text);
      } catch (err) {
        this.logger.warn(
          `LLM classify failed, falling back to heuristic: ${(err as Error).message}`,
        );
      }
    }
    return this.heuristic(text);
  }

  private async classifyWithLlm(text: string): Promise<Classification> {
    const res = await fetch(`${this.apiUrl}/classify`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`classifier ${res.status}`);
    const data = (await res.json()) as Omit<Classification, "source">;
    return { ...data, source: "llm" };
  }

  heuristic(text: string): Classification {
    const t = text.toLowerCase();
    const hasLink = /https?:\/\/|\bwww\./.test(t);
    const lure = /(verify|urgent|prize|gift|otp|password|bank|click)/.test(t);
    if (hasLink && lure)
      return { verdict: "scam", score: 0.9, reason: "Link plus urgency lure.", source: "heuristic" };
    if (hasLink || lure)
      return {
        verdict: "suspicious",
        score: 0.5,
        reason: "Contains a link or pressure language.",
        source: "heuristic",
      };
    return { verdict: "clean", score: 0.1, reason: "No common scam markers.", source: "heuristic" };
  }
}
