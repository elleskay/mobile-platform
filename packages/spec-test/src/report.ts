import type { Requirement, SpecFile } from "./schema.js";
import type { CoverageEntry } from "./coverage.js";
import type { NativeReport, NativeRequirementResult } from "./verification.js";

export interface NativeUnverified {
  req: Requirement;
  results: NativeRequirementResult[];
}

export interface CoverageReport {
  totalRequirements: number;
  coveredRequirements: number;
  uncoveredRequirements: Requirement[];
  failingRequirements: { req: Requirement; failingTests: CoverageEntry[] }[];
  categoryMismatches: { req: Requirement; observed: Set<string> }[];
  /** native/manual requirements not satisfied by a fresh, signed artifact. */
  nativeUnverified: NativeUnverified[];
  coveragePct: number;
  passed: boolean;
}

function isNativeLevel(req: Requirement): boolean {
  return req.verify === "native" || req.verify === "manual";
}

export function buildReport(
  spec: SpecFile,
  entries: CoverageEntry[],
  native?: NativeReport,
): CoverageReport {
  const byId = new Map<string, CoverageEntry[]>();
  for (const e of entries) {
    const arr = byId.get(e.id) ?? [];
    arr.push(e);
    byId.set(e.id, arr);
  }

  const nativeById = new Map<string, NativeRequirementResult[]>();
  for (const r of native?.results ?? []) {
    const arr = nativeById.get(r.id) ?? [];
    arr.push(r);
    nativeById.set(r.id, arr);
  }

  const uncovered: Requirement[] = [];
  const failing: { req: Requirement; failingTests: CoverageEntry[] }[] = [];
  const categoryMismatches: { req: Requirement; observed: Set<string> }[] = [];
  const nativeUnverified: NativeUnverified[] = [];

  for (const req of spec.requirements) {
    // native/manual requirements are proven by a signed artifact, not a
    // recorded test. Their satisfaction comes entirely from the native report.
    if (isNativeLevel(req)) {
      const results = nativeById.get(req.id) ?? [];
      const allOk = results.length > 0 && results.every((r) => r.status.state === "ok");
      if (!allOk) nativeUnverified.push({ req, results });
      continue;
    }

    const hits = byId.get(req.id) ?? [];
    const passing = hits.filter((h) => h.status === "passed");
    const failures = hits.filter((h) => h.status === "failed");

    if (hits.length === 0) {
      uncovered.push(req);
      continue;
    }
    if (passing.length === 0) {
      failing.push({ req, failingTests: failures });
      continue;
    }

    const observedCategories = new Set(
      hits.map((h) => h.category).filter((c): c is string => Boolean(c)),
    );
    if (observedCategories.size > 0 && !observedCategories.has(req.category)) {
      categoryMismatches.push({ req, observed: observedCategories });
    }
  }

  const total = spec.requirements.length;
  const covered = total - uncovered.length - failing.length - nativeUnverified.length;

  return {
    totalRequirements: total,
    coveredRequirements: covered,
    uncoveredRequirements: uncovered,
    failingRequirements: failing,
    categoryMismatches,
    nativeUnverified,
    coveragePct: total === 0 ? 100 : Math.round((covered / total) * 1000) / 10,
    passed:
      uncovered.length === 0 &&
      failing.length === 0 &&
      categoryMismatches.length === 0 &&
      nativeUnverified.length === 0,
  };
}

function describeNativeStatus(r: NativeRequirementResult): string {
  switch (r.status.state) {
    case "ok":
      return "ok";
    case "missing":
      return "missing artifact";
    case "invalid":
      return `invalid: ${r.status.message}`;
    case "unsigned":
      return "unsigned (no checksum)";
    case "tampered":
      return "tampered (checksum mismatch; re-stamp with spec-attest)";
    case "stale":
      return `stale (${r.status.reasons.join(", ")})`;
  }
}

export function renderMarkdown(spec: SpecFile, report: CoverageReport): string {
  const lines: string[] = [];
  lines.push(`# Spec coverage: ${spec.app} v${spec.version}`);
  lines.push("");
  lines.push(
    `**${report.coveragePct}% covered** (${report.coveredRequirements}/${report.totalRequirements} requirements satisfied)`,
  );
  lines.push("");

  if (report.passed) {
    lines.push("All requirements covered by passing tests and fresh native artifacts.");
    lines.push("");
  }

  if (report.uncoveredRequirements.length > 0) {
    lines.push(`## Uncovered (${report.uncoveredRequirements.length})`);
    lines.push("");
    lines.push("| ID | Title | Category | Severity |");
    lines.push("|---|---|---|---|");
    for (const req of report.uncoveredRequirements) {
      lines.push(
        `| \`${req.id}\` | ${req.title} | ${req.category} | ${req.severity} |`,
      );
    }
    lines.push("");
  }

  if (report.failingRequirements.length > 0) {
    lines.push(`## Failing (${report.failingRequirements.length})`);
    lines.push("");
    lines.push("| ID | Title | Failing tests |");
    lines.push("|---|---|---|");
    for (const { req, failingTests } of report.failingRequirements) {
      lines.push(`| \`${req.id}\` | ${req.title} | ${failingTests.length} |`);
    }
    lines.push("");
  }

  if (report.categoryMismatches.length > 0) {
    lines.push(`## Category mismatches (${report.categoryMismatches.length})`);
    lines.push("");
    lines.push(
      "Spec declares a category but the only passing test runs in a different layer (e.g. `category: ui` covered only by a Vitest unit test).",
    );
    lines.push("");
    lines.push("| ID | Spec category | Test categories |");
    lines.push("|---|---|---|");
    for (const m of report.categoryMismatches) {
      lines.push(
        `| \`${m.req.id}\` | ${m.req.category} | ${[...m.observed].join(", ") || "(none)"} |`,
      );
    }
    lines.push("");
  }

  if (report.nativeUnverified.length > 0) {
    lines.push(`## Native/manual unverified (${report.nativeUnverified.length})`);
    lines.push("");
    lines.push(
      "Requirements with `verify: native|manual` need a signed, fresh verification artifact (see docs/adr/0001-testing-architecture.md). The gate does not accept an automated green here.",
    );
    lines.push("");
    lines.push("| ID | Title | Platform | Artifact status |");
    lines.push("|---|---|---|---|");
    for (const { req, results } of report.nativeUnverified) {
      if (results.length === 0) {
        lines.push(`| \`${req.id}\` | ${req.title} | (none recorded) | missing artifact |`);
        continue;
      }
      for (const r of results) {
        lines.push(
          `| \`${req.id}\` | ${req.title} | ${r.platform} | ${describeNativeStatus(r)} |`,
        );
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
