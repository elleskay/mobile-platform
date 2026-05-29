import { recordCoverage } from "./coverage.js";

const SPEC_ID_RE = /^\[([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)+-\d{3,})\]/;

export interface JestSpecOptions {
  /**
   * Category to tag recorded results with, so the gate's category check can run.
   * Use "data" for jest-expo unit tests and "ui" for component (RNTL) tests.
   * Omit to record without a category.
   */
  category?: string;
}

/**
 * Canonical Jest coverage recorder. Works under any Jest-based runner
 * (jest-expo for unit/component, and Detox, which is also Jest). Call once from
 * a setup file referenced by `setupFilesAfterEnv`. Parses the leading [ID] from
 * each test name and records pass/fail to the coverage JSONL.
 *
 *   // tests/jest.setup.ts
 *   import { setupSpecCoverage } from "@platform/spec-test/jest";
 *   setupSpecCoverage({ category: "data" });
 */
export function setupSpecCoverage(opts: JestSpecOptions = {}): void {
  const j = globalThis as unknown as {
    afterEach?: (fn: () => void) => void;
    expect?: { getState?: () => { currentTestName?: string } };
  };
  if (typeof j.afterEach !== "function") {
    throw new Error(
      "setupSpecCoverage() must run inside a Jest test context (no global afterEach found).",
    );
  }
  j.afterEach(() => {
    const name = j.expect?.getState?.().currentTestName ?? "";
    const m = SPEC_ID_RE.exec(name);
    if (!m) return;
    // A failed assertion throws before this hook records, so reaching here means
    // the assertions ran. Jest's own non-zero exit fails the gate on failures.
    recordCoverage({ id: m[1] as string, status: "passed", category: opts.category });
  });
}

/** Explicit recorder for try/catch around flaky native interactions. */
export function recordSpec(
  id: string,
  status: "passed" | "failed",
  category?: string,
): void {
  recordCoverage({ id, status, category });
}
