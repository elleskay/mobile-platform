# Tests

Spec-driven test scaffolding. Copy into your app, then wire the `test:spec` gate.

## Layers (ADR 0001)

| Layer | Spec `verify` | Runner | Import / location | Records as |
|---|---|---|---|---|
| Unit | `unit` | jest-expo | `tests/unit/*.spec.ts` | `data` |
| Component | `component` | jest-expo + React Native Testing Library | `tests/component/*.spec.tsx` | `ui` |
| E2E journey | `e2e` | Maestro | `.maestro/*.yaml` | `functional` |
| Native (call/SMS) | `native` | signed artifact | `verification/` | n/a (artifact) |
| Manual | `manual` | signed artifact | `verification/` | n/a (artifact) |

The app standardizes on **Jest (jest-expo)** for unit + component so one recorder
covers both with proper RN module mocking. **Maestro** runs the e2e journeys
(low flake, one flow for both platforms); since Maestro is not Jest, the
`spec-maestro` shim maps its JUnit output back to coverage. The **API** keeps
Vitest. Native/manual are proven by signed `verification/` artifacts, not tests.

Every test/flow name is prefixed with its spec ID, e.g. `[EX-CHECK-001] ...`. The
ESLint rule `spec-test/require-expect-in-spec-test` fails lint if a jest test with
an `[ID]` has no `expect()`.

## The gate

`npm run test:spec` resets coverage, runs jest (unit+component) and Maestro
(e2e -> ingested), then runs `spec-coverage`. It exits non-zero if any
requirement is uncovered, a covering test fails, a category mismatches, or a
`native`/`manual` artifact is missing/unsigned/tampered/stale. Done means exit 0.

## Suggested package.json

```jsonc
{
  "scripts": {
    "test:unit": "jest",
    "test:e2e": "maestro test .maestro --format junit --output maestro.xml",
    "test:spec": "rimraf .spec-coverage && npm run test:unit && npm run test:e2e && spec-maestro --report maestro.xml && spec-coverage --spec specs/<app>.yml --verification-dir verification --app-version $npm_package_version"
  },
  "devDependencies": {
    "jest": "^29",
    "jest-expo": "~51.0.0",
    "@testing-library/react-native": "^12.5.0",
    "react-test-renderer": "18.2.0",
    "rimraf": "^6.0.0",
    "@platform/spec-test": "*"
  }
}
```

Maestro is a separate binary (`curl -Ls https://get.maestro.mobile.dev | bash`),
not an npm dep. In CI the e2e job needs a device/emulator or Maestro Cloud.

## ESLint

Wire the rule into the app's flat config:

```js
import { eslintPlugin as specTest } from "@platform/spec-test";
export default [
  { files: ["tests/**/*.{ts,tsx}"], plugins: { "spec-test": specTest },
    rules: { "spec-test/require-expect-in-spec-test": "error" } },
];
```
