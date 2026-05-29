import { describe } from "vitest";
import { test, expect } from "@platform/spec-test/vitest";
import { ClassifierService } from "./classifier.service";

describe("ClassifierService heuristic", () => {
  const svc = new ClassifierService();

  test("[API-CLASSIFY-001] link plus lure is scam with high score", () => {
    const r = svc.heuristic("URGENT verify your bank http://evil.example");
    expect(r.verdict).toBe("scam");
    expect(r.score).toBeGreaterThanOrEqual(0.8);
    expect(r.source).toBe("heuristic");
  });

  test("[API-CLASSIFY-002] plain text is clean", () => {
    const r = svc.heuristic("lunch at noon?");
    expect(r.verdict).toBe("clean");
  });
});
