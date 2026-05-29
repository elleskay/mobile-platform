# Spec-driven testing

Every app on this platform is tested against a YAML spec. Every requirement must
have a passing test whose title is prefixed with the requirement ID and that
contains at least one `expect()`. CI gates merge and deploy on 100% spec coverage.

You should rarely need to manually verify an app works. If a spec entry has no
passing test, CI fails. The gate catches structural regressions; for the
user-journey class of bug (see "Failure modes the gate does NOT catch"), a
journey-level e2e is still the only safety net. On mobile this is sharper because
the native interception (call block, SMS filter) runs outside the JS the unit
tests can see.

## How it fits together

```
specs/<app>.yml                  -> declares requirements with IDs
tests/unit/*.spec.ts             -> Vitest tests for pure logic (data)
tests/e2e/*.e2e.ts               -> Detox tests for UI / flows on device
services/api/.../*.spec.ts       -> Vitest tests for API logic
@platform/spec-test (runner)     -> records per-test pass/fail to JSONL
spec-coverage CLI                -> diffs spec IDs vs covered IDs, exits 1 if any uncovered
ESLint rule                      -> fails lint if any spec test body has zero expect()
CI workflow                      -> runs the above, gates deploy
```

## Spec file format

```yaml
app: <appname>          # required
version: 1              # required, integer
requirements:
  - id: <APP>-<DOMAIN>-<NNN>   # required, unique, e.g. SCAM-REPORT-004
    title: One-line summary    # required, 5..200 chars
    category: functional       # required: functional | ui | security | data | a11y
    severity: high             # required: critical | high | medium | low
    given: Precondition        # required
    when: Action               # required
    then: Expected outcome     # required
    verify: e2e                # optional: unit|component|integration|contract|e2e|native|manual
    platforms: [ios, android]  # optional: required result per platform for e2e/native
    tags: [check-and-report]   # optional
    depends_on: []             # optional, must reference other valid IDs
    notes: Free-form notes     # optional
```

The schema is enforced by zod. Unknown fields, duplicate IDs, and invalid
`depends_on` references all throw.

## Verification levels (`verify`) and native artifacts

`verify` states, explicitly, the level that must prove a requirement. It replaces
the older "category equals layer" guesswork (see `docs/adr/0001-testing-architecture.md`).
It is optional during migration: when unset, a requirement falls back to legacy
behavior (covered by any passing recorded test).

`unit | component | integration | contract | e2e` are proven by an automated test
recorded to the coverage JSONL, as usual.

`native | manual` cannot be proven by a JS test (OS-level call/SMS interception
runs out of process). Instead the gate requires a **signed verification artifact**
per requirement and per platform, committed under `verification/`:

```yaml
# verification/SCAM-SMS-001.ios.yml
requirement: SCAM-SMS-001
platform: ios
app_version: 1.4.0
os_tested: "18.3.1"     # the OS build actually exercised
device: iPhone 13
date: 2026-05-20
tester: elleskay
evidence: https://.../recording.mp4
signature: <non-empty>
```

The gate fails a native/manual requirement if its artifact is missing, unsigned,
invalid, or **stale**. Stale means any of: the app version moved past the tested
version; the tested OS is behind `verification/os-baseline.yml` for that platform
(catches an OS point release changing CallKit/SMS behavior with no app bump); or
the artifact is older than the 90-day TTL floor. Read it as "re-verify once per
release or every 90 days, whichever comes first."

Run the gate with the native flags when a spec has native/manual requirements:

```bash
spec-coverage --spec specs/<app>.yml \
  --verification-dir verification \
  --os-baseline verification/os-baseline.yml \
  --app-version 1.4.0
```

`--app-version` is required whenever the spec has any native/manual requirement;
without it the gate exits 2 rather than guess.

Two layers protect each artifact (ADR 0001, R1.5):

- **A, integrity:** `signature` is a checksum over the canonical body. Stamp it
  with `spec-attest --artifact <file>` (and `--check` to verify). The gate
  recomputes it, so editing the body after stamping (e.g. bumping `date`) is
  flagged `tampered`.
- **B, accountability:** the binding attestation is the signed git commit that
  last touched the artifact, by a signer in `verification/allowed-signers`.
  Enforced in CI by `scripts/verify-attestations.sh`, which checks the last
  commit per file and fails closed. It skips while `allowed-signers` is empty.

A proves the body is unchanged; B proves an allowlisted human stands behind it.
See `apps/_template/verification/README.md` for the os-baseline bump convention.

## Verify level drives the runner (the app)

- `unit` (data logic): **jest-expo**, recorded as `data`
- `component` (render a screen): **jest-expo + React Native Testing Library**, recorded as `ui`
- `e2e` (journeys): **Maestro**, recorded as `functional` via the `spec-maestro` shim
- `native` / `manual`: signed `verification/` artifacts, not tests
- An optional admin web surface: **Playwright**

The API service keeps **Vitest**. If a `ui` requirement is only covered by a unit
test, the gate flags a category mismatch and fails, this stops "I covered the
requirement" when only the wrong layer was tested.

## Writing tests

The convention is a test (or Maestro flow) whose name starts with the requirement
ID in brackets. The runner parses `[ID]` and records the result.

```ts
// tests/unit/classifier.spec.ts  (jest-expo, data). Test names carry [ID];
// tests/jest.setup.unit.ts calls setupSpecCoverage({ category: "data" }).
test("[EX-CLASSIFY-001] link plus lure scores as scam", () => {
  const r = localHeuristic("URGENT verify your bank http://evil.example");
  expect(r.verdict).toBe("scam");
  expect(r.score).toBeGreaterThanOrEqual(0.8);
});
```

```tsx
// tests/component/CheckScreen.spec.tsx  (jest-expo + RNTL, ui)
import { render, screen, fireEvent } from "@testing-library/react-native";
import CheckScreen from "@/app/index";

test("[EX-CHECK-003] check button is disabled until text is entered", () => {
  render(<CheckScreen />);
  expect(screen.getByTestId("check-button")).toBeDisabled();
  fireEvent.changeText(screen.getByTestId("message-input"), "x");
  expect(screen.getByTestId("check-button")).toBeEnabled();
});
```

```yaml
# .maestro/check-and-report.yaml  (Maestro, e2e). The flow `name` carries [ID];
# spec-maestro reads it from the JUnit output.
appId: com.elleskay.yourapp
name: "[EX-CHECK-001] check a suspicious message shows a verdict"
---
- launchApp: { clearState: true }
- tapOn: { id: "message-input" }
- inputText: "URGENT verify your bank http://evil.example"
- tapOn: { id: "check-button" }
- assertVisible: { id: "verdict" }
```

Register the recorder once per Jest project from a setup file:

- Unit: `setupFilesAfterEnv` -> `setupSpecCoverage({ category: "data" })` from `@platform/spec-test/jest`
- Component: `setupFilesAfterEnv` -> `setupSpecCoverage({ category: "ui" })` from `@platform/spec-test/jest`
- Maestro: no in-test hook; `spec-maestro --report maestro.xml` ingests the JUnit output after the run.

## The ESLint rule

`@platform/spec-test` exports `eslintPlugin` with the rule
`require-expect-in-spec-test`. Wire it into the app's flat config:

```js
import { eslintPlugin as specTest } from "@platform/spec-test";

export default [
  {
    files: ["tests/**/*.ts", "src/**/*.spec.ts"],
    plugins: { "spec-test": specTest },
    rules: { "spec-test/require-expect-in-spec-test": "error" },
  },
];
```

Without it, a test could carry an `[ID]` title and assert nothing, and the ID
would be marked covered because the test passed. The rule prevents that.

## Running locally

```bash
npm run test:unit     # jest-expo (unit + component, on host)
npm run test:e2e      # maestro (needs a device/emulator or Maestro Cloud)
npm run test:spec     # reset coverage, jest, maestro + spec-maestro ingest, then the gate
```

The gate (`spec-coverage --spec specs/<app>.yml`) exits non-zero if any
requirement is uncovered, any covering test fails, or a requirement's only
passing test is in the wrong layer. The build is not done until it exits 0.

## CI workflow

Copy `apps/_template/.github/workflows/test.yml` into the app. Data + coverage
run on every push (Ubuntu, with a Postgres service for API tests). The Detox e2e
job runs on macOS with a simulator and is gated to PRs to control cost. The
deploy workflow should depend on the gate so a red spec blocks deploy.

## Failure modes the gate catches

- Missing test for a spec entry -> uncovered, exit 1
- Test exists but fails -> failing, exit 1
- Test exists, passes, zero `expect()` -> lint fails before tests run
- Test in the wrong layer (ui requirement only in Vitest) -> category mismatch, exit 1

## Failure modes the gate does NOT catch

- A spec written wrong (the test agrees with a wrong requirement). Spec
  correctness is on the human reviewer.
- Behavior in the app with no spec entry. Review discipline catches it.
- Flaky e2e on device. Use retries; hunt and fix flakes.
- **Decomposed-journey gaps.** A user-facing feature spread across several IDs can
  be 100% covered while one link is broken. On mobile the classic version: the JS
  check-and-report flow is green, the API queue is green, the classifier is green,
  but the native SMS-filter extension was never enabled in the entitlements, so
  real messages are never intercepted. Coverage is 100% and the feature is dead in
  the field. **Mitigation:** every user-facing feature ships at least one
  journey-level e2e across the full path, and native-extension behavior is
  verified on a real device build before release, not only in the simulator.
