import { setupSpecCoverage as jestSetup, recordSpec } from "./jest.js";

// Detox runs on Jest, so its coverage recorder is the generic Jest one with the
// UI category. Kept as a distinct entry point for back-compat and for the ADR
// 0001 flip condition (if e2e ever moves back to Detox). The platform's default
// e2e runner is Maestro (see @platform/spec-test/maestro and docs/TESTING.md).
export function setupSpecCoverage(): void {
  jestSetup({ category: "ui" });
}

export { recordSpec };
