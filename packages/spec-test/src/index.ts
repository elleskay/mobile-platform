export {
  Requirement,
  RequirementCategory,
  RequirementSeverity,
  VerifyLevel,
  Platform,
  SpecFile,
} from "./schema.js";
export { parseSpec, getRequirementIds, SpecParseError } from "./parser.js";
export {
  recordCoverage,
  readCoverage,
  resetCoverage,
  getCoveragePath,
} from "./coverage.js";
export type { CoverageEntry } from "./coverage.js";
export { buildReport, renderMarkdown } from "./report.js";
export type { CoverageReport, NativeUnverified } from "./report.js";
export {
  VerificationArtifact,
  evaluateNativeRequirements,
  hasNativeRequirements,
  compareVersions,
  computeArtifactChecksum,
} from "./verification.js";
export type {
  NativeReport,
  NativeRequirementResult,
  ArtifactStatus,
  StaleReason,
  EvaluateOptions,
} from "./verification.js";
export { plugin as eslintPlugin, requireExpectInSpecTest } from "./eslint-rule.js";
