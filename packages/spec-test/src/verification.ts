import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { SpecFile, Requirement } from "./schema.js";

// A record that a `native` or `manual` requirement was verified by a human on a
// real build/device. Stands in for an automated test result, which cannot exist
// for OS-level behavior (call/SMS interception runs out of process).
// See docs/adr/0001-testing-architecture.md.
//
// Two layers protect it (Phase 1.5):
//  A) `signature` holds an integrity CHECKSUM over the canonical artifact body
//     minus the signature field (verified here by the gate). It stops silent
//     edits, e.g. bumping `date` to dodge the TTL, without re-stamping.
//  B) The binding human attestation is the GIT COMMIT SIGNATURE on the commit
//     that last touched this file, by an allowlisted signer. That is enforced in
//     CI (scripts/verify-attestations.sh), not here, because it needs git.
// The in-file checksum is integrity; the signed commit is accountability.
export const VerificationArtifact = z
  .object({
    requirement: z.string(),
    platform: z.enum(["ios", "android"]).optional(),
    app_version: z.string().min(1),
    os_tested: z.string().min(1),
    device: z.string().min(1),
    date: z.string().min(1), // ISO date, e.g. 2026-05-20
    tester: z.string().min(1),
    // Required: every artifact must point at a recording/log. The gate checks
    // presence, not the link's content (evidence-checksum gating is deferred).
    evidence: z.string().min(1),
    // sha256:<hex> over the canonical body minus this field. Stamp with
    // `spec-attest`. Absent => unsigned; present but mismatched => tampered.
    signature: z.string().optional(),
  })
  .strict();

export type VerificationArtifact = z.infer<typeof VerificationArtifact>;

export type StaleReason = "app-version" | "os-version" | "ttl";

export type ArtifactStatus =
  | { state: "ok"; artifact: VerificationArtifact }
  | { state: "missing"; path: string }
  | { state: "invalid"; path: string; message: string }
  | { state: "unsigned"; artifact: VerificationArtifact }
  | { state: "tampered"; artifact: VerificationArtifact; expected: string }
  | { state: "stale"; artifact: VerificationArtifact; reasons: StaleReason[] };

/**
 * Integrity checksum (layer A): sha256 over the canonical artifact body with the
 * `signature` field removed and keys sorted, so serialization order does not
 * affect the result. Returned as `sha256:<hex>`.
 */
export function computeArtifactChecksum(artifact: VerificationArtifact): string {
  const entries = Object.entries(artifact).filter(([k, v]) => k !== "signature" && v !== undefined);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonical = JSON.stringify(Object.fromEntries(entries));
  return "sha256:" + createHash("sha256").update(canonical).digest("hex");
}

export interface NativeRequirementResult {
  id: string;
  /** "_" when the requirement is platform-agnostic. */
  platform: string;
  path: string;
  status: ArtifactStatus;
}

export interface NativeReport {
  results: NativeRequirementResult[];
  failures: NativeRequirementResult[];
}

export interface EvaluateOptions {
  /** Directory holding verification/<id>[.<platform>].yml artifacts. */
  verificationDir: string;
  /** Path to verification/os-baseline.yml (optional). */
  osBaselinePath?: string;
  /** Current app version under release. Drives the (a) app-moved trigger. */
  appVersion: string;
  /** Defaults to now. Injectable for tests. */
  now?: Date;
  /** Hard TTL floor in days. Default 90. */
  maxAgeDays?: number;
}

const OsBaseline = z.record(z.enum(["ios", "android"]), z.string()).optional();

/** Numeric dotted-version compare. Returns -1/0/1, or null if unparseable. */
export function compareVersions(a: string, b: string): number | null {
  const pa = a.split(/[.\-+_]/).map(Number);
  const pb = b.split(/[.\-+_]/).map(Number);
  if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return null;
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function isNativeLevel(req: Requirement): boolean {
  return req.verify === "native" || req.verify === "manual";
}

/** Expected artifact path for a requirement + platform. */
function artifactPath(dir: string, id: string, platform: string): string {
  return platform === "_"
    ? join(dir, `${id}.yml`)
    : join(dir, `${id}.${platform}.yml`);
}

/**
 * R1 staleness: an artifact is stale if ANY of
 *  (a) the app moved past the tested app version,
 *  (b) the OS moved past the tested OS (vs os-baseline.yml for that platform),
 *  (c) more than maxAgeDays have passed (the TTL safety floor).
 * App-version alone is insufficient: an OS point release can change
 * CallKit/CallDirectory/SMS-filter behavior with no app bump, which (b) and (c)
 * are there to catch.
 */
function staleReasons(
  artifact: VerificationArtifact,
  opts: Required<Pick<EvaluateOptions, "appVersion" | "now" | "maxAgeDays">>,
  baseline: Record<string, string> | undefined,
): StaleReason[] {
  const reasons: StaleReason[] = [];

  // (a) app moved
  const appCmp = compareVersions(opts.appVersion, artifact.app_version);
  if (appCmp === null) {
    if (opts.appVersion !== artifact.app_version) reasons.push("app-version");
  } else if (appCmp > 0) {
    reasons.push("app-version");
  }

  // (b) OS moved past tested, judged against the baseline for this platform
  const platformKey = artifact.platform;
  if (baseline && platformKey && baseline[platformKey]) {
    const osCmp = compareVersions(artifact.os_tested, baseline[platformKey]);
    if (osCmp !== null && osCmp < 0) reasons.push("os-version");
  }

  // (c) TTL floor
  const tested = new Date(artifact.date);
  if (!Number.isNaN(tested.getTime())) {
    const ageDays = (opts.now.getTime() - tested.getTime()) / 86_400_000;
    if (ageDays > opts.maxAgeDays) reasons.push("ttl");
  } else {
    // Unparseable date cannot be trusted as fresh.
    reasons.push("ttl");
  }

  return reasons;
}

function readArtifact(path: string): ArtifactStatus {
  if (!existsSync(path)) return { state: "missing", path };
  let doc: unknown;
  try {
    doc = parseYaml(readFileSync(path, "utf8"));
  } catch (err) {
    return { state: "invalid", path, message: (err as Error).message };
  }
  const parsed = VerificationArtifact.safeParse(doc);
  if (!parsed.success) {
    return { state: "invalid", path, message: parsed.error.issues[0]?.message ?? "schema error" };
  }
  return { state: "ok", artifact: parsed.data };
}

function loadBaseline(path: string | undefined): Record<string, string> | undefined {
  if (!path || !existsSync(path)) return undefined;
  try {
    const doc = parseYaml(readFileSync(path, "utf8")) as unknown;
    const parsed = OsBaseline.parse(doc);
    return parsed as Record<string, string> | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Evaluate every `native`/`manual` requirement in the spec against its
 * verification artifact(s). Pure of the rest of the gate; the result is folded
 * into the coverage report by report.ts.
 */
export function evaluateNativeRequirements(
  spec: SpecFile,
  opts: EvaluateOptions,
): NativeReport {
  const now = opts.now ?? new Date();
  const maxAgeDays = opts.maxAgeDays ?? 90;
  const baseline = loadBaseline(opts.osBaselinePath);
  const results: NativeRequirementResult[] = [];

  for (const req of spec.requirements) {
    if (!isNativeLevel(req)) continue;
    const platforms = req.platforms.length > 0 ? req.platforms : ["_"];
    for (const platform of platforms) {
      const path = artifactPath(opts.verificationDir, req.id, platform);
      let status = readArtifact(path);
      if (status.state === "ok") {
        const { artifact } = status;
        const sig = artifact.signature?.trim();
        if (!sig) {
          status = { state: "unsigned", artifact };
        } else {
          // Layer A: the in-file checksum must match the body. Catches a body
          // edited after stamping (e.g. date bumped to dodge the TTL).
          const expected = computeArtifactChecksum(artifact);
          if (sig !== expected) {
            status = { state: "tampered", artifact, expected };
          } else {
            const reasons = staleReasons(artifact, { appVersion: opts.appVersion, now, maxAgeDays }, baseline);
            if (reasons.length > 0) status = { state: "stale", artifact, reasons };
          }
        }
      }
      results.push({ id: req.id, platform, path, status });
    }
  }

  return { results, failures: results.filter((r) => r.status.state !== "ok") };
}

/** True if the spec has any requirement that needs a verification artifact. */
export function hasNativeRequirements(spec: SpecFile): boolean {
  return spec.requirements.some(isNativeLevel);
}
