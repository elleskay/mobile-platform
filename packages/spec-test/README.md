# @platform/spec-test

Spec-driven test runner. Validates a YAML spec, records which requirement IDs are
covered by passing tests, verifies native/manual requirements against signed
artifacts, and gates CI on full coverage. Dual-published (ESM + CJS) so Vitest,
Jest (jest-expo/Detox), and Node CLIs can all consume it.

## The convention

Tests name themselves with the requirement ID in brackets; there is no
`specTest()` function. A per-runner setup parses the `[ID]` and records pass/fail.

```ts
// Vitest (API) or jest-expo (app unit/component)
test("[EX-CLASSIFY-001] link plus lure scores as scam", () => {
  expect(localHeuristic("verify http://x").verdict).toBe("scam");
});
```

```yaml
# Maestro (app e2e): the flow name carries the [ID]
name: "[EX-CHECK-001] check shows a verdict"
```

Register the recorder once per runner:

| Runner | Import | Setup |
|---|---|---|
| Vitest (API) | `@platform/spec-test/vitest` | `setupFiles` -> `setupSpecCoverage()` |
| jest-expo (app) | `@platform/spec-test/jest` | `setupFilesAfterEnv` -> `setupSpecCoverage({ category })` |
| Detox (legacy) | `@platform/spec-test/detox` | `setupFilesAfterEnv` -> `setupSpecCoverage()` |
| Maestro (app e2e) | `@platform/spec-test/maestro` | `spec-maestro --report maestro.xml` after the run |
| Playwright (web admin) | `@platform/spec-test/playwright` | `test`/`expect` re-exports |

## CLIs

- `spec-coverage --spec specs/<app>.yml [--verification-dir <dir> --app-version <v>]`
  parses the spec, reads the coverage JSONL, evaluates native/manual artifacts,
  writes a markdown report, exits non-zero on any gap.
- `spec-attest --artifact <file> [--check]` stamps (or verifies) the integrity
  checksum on a native/manual verification artifact.
- `spec-maestro --report <junit.xml>` ingests a Maestro JUnit report into coverage.

## What the gate catches

- Missing test for a requirement -> uncovered, exit 1.
- A covering test fails -> exit 1.
- A `[ID]` test with zero `expect()` -> the ESLint rule fails before tests run.
- A requirement proven only in the wrong layer (category mismatch) -> exit 1.
- A `native`/`manual` requirement whose signed artifact is missing, unsigned,
  tampered (checksum mismatch), or stale (app/OS moved, or past the TTL) -> exit 1.

## What it does NOT catch

The gate verifies that each requirement has a passing, asserting test (or a fresh
signed artifact). It does not verify the spec is correct or complete:

1. **Wrong spec.** Test agrees with a wrong requirement; both pass. Human review of
   spec changes is the mitigation.
2. **Behavior with no spec entry.** No automated check for "added a feature without
   a spec." Review discipline catches it.
3. **Decomposed-journey gap.** A feature split across multiple IDs can hit 100%
   coverage while the chain between them is broken. On mobile this is sharpest at
   the native seam: the JS flow, the API, and the classifier can each be green
   while the OS-level SMS-filter extension was never enabled, so nothing is
   intercepted in the field. Mitigation: one journey-level Maestro e2e per
   user-facing feature, plus real-device verification of native behavior (the
   `native` artifact layer). See `docs/TESTING.md` and `docs/adr/0001-testing-architecture.md`.

## Why this package is private

The platform copies, it does not import a published version. Each app pins its own
snapshot from `packages/` so breaking changes never propagate without explicit
action. See the platform `README.md` "Opinions".
