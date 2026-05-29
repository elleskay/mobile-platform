import { test as base, expect } from "@playwright/test";
import { recordCoverage } from "./coverage.js";

const SPEC_ID_RE = /^\[([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)+-\d{3,})\]/;

/**
 * Extended Playwright `test` that auto-records spec coverage.
 *
 * Title convention: "[ARM-XXX-001] human description". The leading
 * [ID] is parsed; if present, the test's outcome is appended to
 * .spec-coverage/results.jsonl in a post-test hook.
 *
 * Tests without a [ID] prefix run normally and are not recorded.
 */
export const test = base.extend<{ specCoverage: void }>({
  specCoverage: [
    async ({}, use, testInfo) => {
      await use();
      const m = SPEC_ID_RE.exec(testInfo.title);
      if (!m) return;
      const id = m[1] as string;
      const status: "passed" | "failed" =
        testInfo.status === "passed" ? "passed" : "failed";
      recordCoverage({
        id,
        status,
        file: testInfo.file,
        durationMs: testInfo.duration,
      });
    },
    { auto: true },
  ],
});

export { expect };
