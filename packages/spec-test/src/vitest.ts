import { test, expect, afterEach } from "vitest";
import { recordCoverage } from "./coverage.js";

export { test, expect };

const SPEC_ID_RE = /^\[([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)+-\d{3,})\]/;

/**
 * Register a global afterEach hook that parses the test name for a spec ID
 * and records pass/fail to the coverage JSONL. Call this once from a Vitest
 * setupFile.
 */
export function setupSpecCoverage(): void {
  afterEach((ctx) => {
    const taskName = ctx.task?.name ?? "";
    const m = SPEC_ID_RE.exec(taskName);
    if (!m) return;
    const id = m[1] as string;
    const failed = !!ctx.task?.result?.errors?.length;
    recordCoverage({
      id,
      status: failed ? "failed" : "passed",
      durationMs: ctx.task?.result?.duration,
    });
  });
}
