#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { recordCoverage } from "./coverage.js";

// Maestro -> coverage shim. Maestro is our e2e runner (ADR 0001, R3). Its flows
// are YAML and run outside Jest, so they cannot use the Jest/Detox afterEach
// recorder. Instead Maestro emits a JUnit report (`maestro test --format junit
// --output report.xml`); this shim parses it, maps flow names carrying a spec
// `[ID]` to coverage entries, and appends them to the same JSONL the gate reads.
//
//   spec-maestro --report report.xml [--category functional]
//
// Flow naming convention: the flow's name (JUnit testcase name or classname)
// starts with the requirement id in brackets, e.g. "[SCAM-FLOW-001] onboarding".
// Additive: touches nothing in the engine.

const SPEC_ID_RE = /\[([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)+-\d{3,})\]/;

export interface JunitCase {
  name: string;
  passed: boolean;
}

/**
 * Minimal JUnit parse, scoped to the shape Maestro emits: <testcase> elements,
 * self-closing when passed, or containing <failure>/<error> when failed. Kept
 * dependency-free on purpose; swap for a real XML parser if the format drifts.
 */
export function parseJunit(xml: string): JunitCase[] {
  const cases: JunitCase[] = [];
  // Match each testcase element (self-closing or with a body).
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1] ?? "";
    const body = m[3] ?? "";
    const nameMatch = /\b(?:name|classname)\s*=\s*"([^"]*)"/.exec(attrs);
    const name = nameMatch?.[1] ?? "";
    const failed = /<(failure|error)\b/.test(body);
    cases.push({ name, passed: !failed });
  }
  return cases;
}

/** Parse a JUnit report and record coverage for every [ID]-named flow. */
export function ingestJunit(path: string, category = "functional"): { recorded: number; skipped: number } {
  const xml = readFileSync(path, "utf8");
  const cases = parseJunit(xml);
  let recorded = 0;
  let skipped = 0;
  for (const c of cases) {
    const idMatch = SPEC_ID_RE.exec(c.name);
    if (!idMatch) {
      skipped++;
      continue;
    }
    recordCoverage({
      id: idMatch[1] as string,
      status: c.passed ? "passed" : "failed",
      category,
    });
    recorded++;
  }
  return { recorded, skipped };
}

function main(): void {
  const argv = process.argv.slice(2);
  let report = "";
  let category = "functional";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--report") report = argv[++i] ?? "";
    else if (a === "--category") category = argv[++i] ?? category;
    else if (a === "--help" || a === "-h") {
      console.log("spec-maestro --report <junit.xml> [--category functional]");
      process.exit(0);
    }
  }
  if (!report) {
    console.error("error: --report <junit.xml> is required");
    process.exit(2);
  }
  const { recorded, skipped } = ingestJunit(resolve(report), category);
  console.log(`spec-maestro: recorded ${recorded} flow(s), skipped ${skipped} without a [ID] prefix`);
}

// Only run as CLI, not when imported for the parse helpers.
if (process.argv[1] && /maestro\.(js|ts)$/.test(process.argv[1])) {
  main();
}
