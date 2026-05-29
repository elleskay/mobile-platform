import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { dirname } from "node:path";

export interface CoverageEntry {
  id: string;
  status: "passed" | "failed";
  category?: string;
  file?: string;
  durationMs?: number;
  timestamp: string;
}

const DEFAULT_PATH =
  process.env.SPEC_COVERAGE_FILE ?? ".spec-coverage/results.jsonl";

export function getCoveragePath(): string {
  return DEFAULT_PATH;
}

export function recordCoverage(entry: Omit<CoverageEntry, "timestamp">): void {
  const path = getCoveragePath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const line = JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  appendFileSync(path, line + "\n", "utf8");
}

export function readCoverage(path: string = getCoveragePath()): CoverageEntry[] {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf8");
  return raw
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as CoverageEntry);
}

export function resetCoverage(path: string = getCoveragePath()): void {
  try {
    if (existsSync(path)) {
      unlinkSync(path);
    }
  } catch (err) {
    // Race: another setup file may have unlinked it between existsSync and
    // unlinkSync. Safe to ignore ENOENT.
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }
}
