#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { parseSpec, SpecParseError } from "./parser.js";
import { readCoverage } from "./coverage.js";
import { buildReport, renderMarkdown } from "./report.js";
import { evaluateNativeRequirements, hasNativeRequirements } from "./verification.js";
import type { NativeReport } from "./verification.js";

interface Args {
  spec: string;
  coverage: string;
  out: string;
  strict: boolean;
  verificationDir: string;
  osBaseline?: string;
  appVersion?: string;
  maxAgeDays: number;
  now?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    spec: "",
    coverage: ".spec-coverage/results.jsonl",
    out: "spec-coverage.md",
    strict: true,
    verificationDir: "verification",
    maxAgeDays: 90,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--spec") args.spec = argv[++i] ?? "";
    else if (a === "--coverage") args.coverage = argv[++i] ?? args.coverage;
    else if (a === "--out") args.out = argv[++i] ?? args.out;
    else if (a === "--no-strict") args.strict = false;
    else if (a === "--verification-dir") args.verificationDir = argv[++i] ?? args.verificationDir;
    else if (a === "--os-baseline") args.osBaseline = argv[++i];
    else if (a === "--app-version") args.appVersion = argv[++i];
    else if (a === "--max-age-days") args.maxAgeDays = Number(argv[++i] ?? args.maxAgeDays);
    else if (a === "--now") args.now = argv[++i];
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  if (!args.spec) {
    console.error("error: --spec <path/to/spec.yml> is required");
    printHelp();
    process.exit(2);
  }
  return args;
}

function printHelp(): void {
  console.log(`spec-coverage --spec <path> [options]

  --spec              Path to the spec YAML file (required)
  --coverage          Path to JSONL coverage results (default: .spec-coverage/results.jsonl)
  --out               Markdown report output path (default: spec-coverage.md)
  --no-strict         Exit 0 even if requirements are unverified

  Native/manual verification (verify: native|manual requirements):
  --verification-dir  Dir of <id>[.<platform>].yml artifacts (default: verification)
  --os-baseline       Path to os-baseline.yml (default: <verification-dir>/os-baseline.yml)
  --app-version       Current app version under release (required if any native reqs)
  --max-age-days      Native artifact TTL floor in days (default: 90)
  --now               Override "now" as ISO date (testing only)
`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  let parsed;
  try {
    parsed = parseSpec(resolve(args.spec));
  } catch (err) {
    if (err instanceof SpecParseError) {
      console.error(`spec-coverage: ${err.message}`);
      if (err.issues) {
        console.error(JSON.stringify(err.issues, null, 2));
      }
      process.exit(2);
    }
    throw err;
  }

  let native: NativeReport | undefined;
  if (hasNativeRequirements(parsed.spec)) {
    if (!args.appVersion) {
      console.error(
        "error: spec has verify: native|manual requirements; --app-version is required to evaluate artifact staleness.",
      );
      process.exit(2);
    }
    native = evaluateNativeRequirements(parsed.spec, {
      verificationDir: resolve(args.verificationDir),
      osBaselinePath: resolve(args.osBaseline ?? join(args.verificationDir, "os-baseline.yml")),
      appVersion: args.appVersion,
      now: args.now ? new Date(args.now) : undefined,
      maxAgeDays: args.maxAgeDays,
    });
  }

  const entries = readCoverage(resolve(args.coverage));
  const report = buildReport(parsed.spec, entries, native);
  const md = renderMarkdown(parsed.spec, report);

  const outPath = resolve(args.out);
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, md, "utf8");

  console.log("");
  console.log(
    `${parsed.spec.app} v${parsed.spec.version}: ${report.coveragePct}% covered (${report.coveredRequirements}/${report.totalRequirements})`,
  );
  if (report.uncoveredRequirements.length > 0) {
    console.log(`  uncovered: ${report.uncoveredRequirements.length}`);
    for (const r of report.uncoveredRequirements.slice(0, 10)) {
      console.log(`    - ${r.id}: ${r.title}`);
    }
    if (report.uncoveredRequirements.length > 10) {
      console.log(`    ... and ${report.uncoveredRequirements.length - 10} more`);
    }
  }
  if (report.failingRequirements.length > 0) {
    console.log(`  failing: ${report.failingRequirements.length}`);
    for (const f of report.failingRequirements.slice(0, 10)) {
      console.log(`    - ${f.req.id}: ${f.req.title}`);
    }
  }
  if (report.categoryMismatches.length > 0) {
    console.log(`  category-mismatch: ${report.categoryMismatches.length}`);
  }
  if (report.nativeUnverified.length > 0) {
    console.log(`  native/manual unverified: ${report.nativeUnverified.length}`);
    for (const { req, results } of report.nativeUnverified.slice(0, 10)) {
      const detail =
        results.length === 0
          ? "missing artifact"
          : results
              .map((r) => {
                const s = r.status.state;
                return s === "stale"
                  ? `${r.platform}: stale (${r.status.state === "stale" ? r.status.reasons.join(", ") : ""})`
                  : `${r.platform}: ${s}`;
              })
              .join("; ");
      console.log(`    - ${req.id}: ${detail}`);
    }
  }
  console.log(`  report: ${outPath}`);

  if (args.strict && !report.passed) {
    process.exit(1);
  }
}

main();
