# ADR 0001: Spec-driven testing architecture for mobile + API

- **Status:** Accepted (2026-05-29)
- **Date:** 2026-05-29
- **Supersedes:** the implicit "category equals layer" model described in `docs/TESTING.md`
- **Deciders:** repo owner

## Context

This platform ships two deployables (an Expo/React Native app and a NestJS API)
plus a set of OS-level native extensions (iOS Call Directory + Message Filter,
Android CallScreeningService). The spec-driven gate was carried over from the
web platform, where its runners are Playwright (browser e2e) and Vitest (host
logic).

The engine itself (spec schema -> coverage JSONL -> CLI gate -> ESLint rule) is
framework-agnostic and worth keeping. The problem is the execution model:

1. The signature features (call/SMS blocking) run out-of-process in the OS and
   cannot be driven by any JS runner, so the gate can read 100% while the feature
   is dead in the field.
2. `category` doubles as "which layer must prove this," via a fuzzy mismatch
   heuristic, so there is no explicit, auditable statement of how strongly a
   requirement is verified.
3. There is no component layer, no app<->API contract layer, and no per-platform
   dimension, despite iOS/Android differing exactly on the features that matter.

This ADR proposes a redesign that keeps the engine and rebuilds the layers on a
real test pyramid, with an explicit verification level per requirement and an
honest mechanism for things that cannot be automated.

## Decision

### 1. Keep the engine, extend the schema

Unchanged: the spec file, the coverage JSONL, the CLI gate, the ESLint
`require-expect-in-spec-test` rule, the API's Vitest layer.

Add two fields to each requirement and split "what kind of requirement" from
"how strongly it is proven":

```yaml
requirements:
  - id: SCAM-SMS-001
    title: Known-scam SMS is filtered by the OS
    category: functional          # taxonomy, unchanged: functional|ui|security|data|a11y
    verify: native                # NEW: unit|component|integration|contract|e2e|native|manual
    platforms: [ios, android]     # NEW: required result per platform for e2e/native
    severity: critical
    given: ...
    when: ...
    then: ...
```

`verify` replaces the implicit category-to-layer heuristic. The gate now requires
a passing result **at the declared level** (a result recorded at a weaker level
does not satisfy a stronger `verify`). This is an explicit, reviewable contract
instead of a guess.

### 2. The layer model (test pyramid, three surfaces)

```
   MANUAL / NATIVE   real-device call/SMS block, store-review behavior   -> signed artifact, not a test
   E2E               Detox (app journeys) | supertest (API)              -> few, journey-level
   CONTRACT          shared zod schemas in packages/contracts            -> the app<->API seam (shapes)
   INTEGRATION       Nest TestingModule + real Postgres + real SQS       -> API wiring
   COMPONENT         jest-expo + React Native Testing Library            -> app UI behavior
   UNIT              jest-expo (app) | vitest (API logic)                -> many, fast, pure
```

### 3. Runners per layer

| Layer        | App                          | API                                   | Native              |
|--------------|------------------------------|---------------------------------------|---------------------|
| Unit         | jest-expo                    | vitest                                | -                   |
| Component    | jest-expo + RNTL             | -                                     | -                   |
| Integration  | -                            | Nest TestingModule + Testcontainers / LocalStack (real Postgres + SQS) | - |
| Contract     | derives client types from `packages/contracts` | derives DTO validation from `packages/contracts` | - |
| E2E          | Maestro (YAML flows, same on both platforms) | supertest against the running app   | -                   |
| Native/Manual| -                            | -                                     | XCTest / Espresso or real-device checklist |

### 4. Native and manual requirements get a signed verification artifact

`verify: native | manual` cannot produce a JSONL test result. Instead the gate
requires a committed artifact per requirement (and per platform):

```yaml
# verification/SCAM-SMS-001.ios.yml
requirement: SCAM-SMS-001
platform: ios
app_version: 1.4.0
os_tested: "18.3.1"          # the OS build actually exercised
device: iPhone 13
date: 2026-05-20
tester: elleskay
evidence: https://.../screen-recording.mp4
signature: <commit-signed or checksummed>
```

The gate fails if the artifact is missing, unsigned, or **stale** (see staleness
rule below). This tracks the OS-level features to closure without the gate ever
emitting a green it did not earn.

## Folded-in refinements (review feedback)

### R1. Artifact staleness keys off (app version OR min-tested-OS) plus a hard TTL

App version alone is insufficient and misses the case that matters most here:
iOS or Android can change CallKit / Call Directory / Message Filter / call-
screening behavior in an **OS point release with no app bump**, and a
version-fresh artifact would sail through. That is precisely the lie we are
trying to stop.

An artifact is **stale** (gate fails) if **any** of:

- **(a) App moved:** `current_app_version > artifact.app_version`. Any app build
  changes the native binary, so native artifacts do not carry forward across app
  versions.
- **(b) OS moved:** for the artifact's platform, a relevant newer OS has shipped
  beyond `artifact.os_tested`, judged against a maintained baseline file
  `verification/os-baseline.yml` (current iOS/Android versions we claim to handle).
  This catches behavior drift with no app change.
- **(c) Time passed:** `now - artifact.date > MAX_AGE_TTL` (90 days),
  unconditionally. Read the rule as **"re-verify once per release OR every 90
  days, whichever comes first."** In practice trigger (a) fires far more often
  than 90 days, so the TTL is the safety floor for a native feature that has sat
  untouched in production for a quarter, not a routine quarterly chore. Shorten
  only if we do not trust ourselves to keep `os-baseline.yml` current; lengthen
  only if manual re-verification gets expensive AND the baseline is reliably
  maintained.

Honest limit: detecting "this specific OS point release changed CallKit" is human
judgment. The OS baseline encodes that judgment when we have it; the TTL is the
dumb-but-reliable floor for when we do not. Both are required, not either/or.

### R2. The contract layer proves shapes, not behavior or sequencing

The shared-zod `packages/contracts` layer asserts that request/response **shapes**
match between app and API. A response can satisfy the schema and still be wrong:
correct fields, wrong values; correct shape, wrong order of operations; correct
single call, broken multi-step sequence.

Therefore a green contract layer must **not** be read as "the app<->API seam is
covered." Seam behavior and sequencing belong to **integration** and **e2e**, or
to proper **consumer-driven contracts** (Pact) if we later want the API verified
against recorded consumer expectations. The gate will treat `verify: contract` as
satisfying only shape-level requirements; any requirement whose `then` describes
behavior or ordering must declare `verify: integration` or `verify: e2e`, not
`contract`. This is enforced by review, and we should add a lint/spec check that
flags behavioral language under a `contract` requirement.

### R3. RESOLVED: e2e is Maestro; jest-expo decision now stands alone

**Decision: Maestro, not Detox.**

Reasoning for the record: the critical behavior (call/SMS blocking) is verified in
the **native-artifact layer, not at e2e**. The e2e layer is therefore only journey
smoke: onboarding, settings, blocked-call log, list management. When e2e is not
carrying the hard stuff, optimize it for **low flake and low maintenance**, which
is Maestro's strength: readable YAML, one flow that runs on both platforms, and no
macOS-CI-plus-flake tax. It also keeps the agent-driven MCP testing path open.

Accepted cost: Maestro does not run under Jest, so it will **not** write to the
Jest coverage recorder. We build the small out-of-band Maestro -> coverage shim
noted earlier (parse the run report, map flow names to `[ID]`s, append to the
JSONL). This is explicit, accepted glue.

Consequence for the runner standardization: with the "one recorder" argument
retired, the app unit+component runner decision **stands on its own merits**. We
keep **jest-expo** there on React Native module-mocking fidelity, independent of
the e2e choice. (Final unit/component runner call is confirmed in Phase 2.)

**Flip condition (auditable):** revisit Detox only if we later want everything in
one Jest recorder with zero glue code AND we hit journeys that depend on tight
internal-state sync that black-box waiting handles poorly. Not expected for this
app.

### R4. Pull the native-artifact reader forward

The native-artifact flow is the entire point of the redesign: it is where the
gate keeps lying about call/SMS blocking, and it stays a lie the longest if
sequenced last. So a **minimal artifact reader is pulled into Phase 1**: parse
`verification/*.yml`, enforce presence + signature + the R1 staleness rule, and
let `verify: native|manual` requirements be satisfied (or failed) by it. The
richer pieces (OS-baseline tooling, evidence-link validation, per-device matrices)
can come later, but the gate must stop emitting unearned green on native
requirements in the first increment, not the last.

## Consequences

**Positive**
- The gate stops giving false confidence on the features that define the app.
- Most verification load moves to cheap, fast layers (unit/component/contract).
- The app<->API seam is tested, not assumed, with its limits stated.
- `verify` + `platforms` make the verification posture explicit and auditable.

**Negative / costs**
- More moving parts: Testcontainers/LocalStack, a contracts package, RNTL, a
  native verification process with human sign-off.
- Detox (if chosen) adds macOS CI cost and flake.
- The artifact TTL creates recurring manual re-verification work, by design.

**Risks**
- OS-baseline upkeep is manual; the TTL is the mitigation when it lapses.
- A heavy gate can tempt people to weaken `verify` levels to go green. Review
  discipline on spec changes is the control.

## Sequencing

1. **(in progress) Schema `verify` + `platforms`, and the minimal native-artifact
   reader (R4).** Gate stops faking native coverage in increment one.
2. App runner: confirm **jest-expo** for unit+component (R3 resolved; decision now
   on RN-fidelity grounds), and build the out-of-band Maestro -> coverage shim for
   e2e journey smoke.
3. `packages/contracts` (shared zod) + shape-level contract tests, with the R2
   guard against behavioral requirements declaring `contract`.
4. API integration tests with Testcontainers (real Postgres + SQS).
5. OS-baseline tooling, evidence validation, per-device matrix for native.

## Alternatives considered

- **Keep category-as-layer.** Rejected: it is implicit and cannot express
  "this needs e2e" vs "this needs a unit test" without guessing.
- **Full consumer-driven contracts (Pact) from day one.** Deferred: heavier than
  warranted for a single consumer; shared-zod shapes plus integration/e2e cover
  most of the seam now, and Pact remains an option if the consumer count grows.
- **All-manual native verification with no gate involvement.** Rejected: loses
  traceability; the signed-artifact-in-the-gate approach keeps native requirements
  visible and forces re-verification on staleness.
