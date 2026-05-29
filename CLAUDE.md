# Mobile platform template, Claude Code conventions

This repo is a platform-layer template for React Native (Expo) apps backed by a NestJS API on AWS serverless. When working in repos cloned from it, follow these rules. It is the mobile sibling of the web `platform` template; mobile and NestJS belong here, not in the web one.

## Structure

```
apps/
├── _template/                       # Overlay references for an Expo app
│   ├── app.config.ts                # Expo config + config plugins for native modules
│   ├── native/
│   │   ├── ios/CallDirectory/        # CallKit Call Directory extension (Swift) reference
│   │   ├── ios/MessageFilter/        # ILMessageFilterExtension (Swift) reference
│   │   └── android/callscreening/    # CallScreeningService + SMS role (Kotlin) reference
│   ├── lib/api.ts                    # Typed API client (reads EXPO_PUBLIC_API_URL)
│   ├── lib/push.ts                   # Expo push registration (no-ops without project id)
│   ├── lib/auth.ts                   # Secure token storage (expo-secure-store)
│   ├── specs/                        # Spec YAML lives here per app
│   ├── tests/                        # jest-expo (unit + component) + Maestro (e2e) scaffolding
│   └── README.md
└── _demo/                            # Working demo Expo app. Platform CI typechecks +
                                      # prebuild-dry-runs this and synths the construct.

services/
├── _template/                       # Full NestJS service (a workspace). Copy to services/<app>.
│   ├── src/main.ts                  # Local HTTP bootstrap
│   ├── src/lambda.ts                # Lambda handler (serverless-express)
│   ├── src/app.module.ts
│   ├── src/health/                  # Liveness/readiness
│   ├── src/reports/                 # Check-and-report domain (controller/service/DTO)
│   ├── src/reports/reports.consumer.ts   # SQS report-intake consumer
│   ├── src/search/opensearch.service.ts  # Scam-message clustering client (no-ops without endpoint)
│   └── src/classifier/              # LLM scam/phishing classifier hook (no-ops without key)

infra/
├── cdk/_template/                   # Full CDK package. Copy and rename per app.
│   ├── bin/app.ts
│   ├── lib/api-stack.ts
│   ├── lib/constructs/NestjsApi.ts  # The reusable construct (Lambda + API GW + SQS + optional OpenSearch)
│   ├── package.json, tsconfig.json, cdk.json
│   └── README.md
├── cdk/_setup/                      # One-time stack: GitHub OIDC + IAM role
└── iam/cdk-deploy-policy.json       # Least-privilege IAM policy

scripts/verify-deploy.sh             # Post-deploy smoke test

.github/workflows/
├── ci.yml                           # typecheck, lint, expo-doctor, nest build, cdk synth
├── security.yml                     # CodeQL, gitleaks, npm audit
├── mobile-build.yml                 # EAS build + submit + OTA update
└── deploy-api.yml                   # OIDC, build, CDK deploy, smoke test
```

## What belongs in this template

Only the cross-cutting platform layer:

- CI/CD workflows (API deploy + mobile EAS build)
- Reusable CDK construct + CDK package scaffold (`infra/cdk/_template/`)
- IAM policy JSON
- Expo app reference overlay (`apps/_template/`), including native call/SMS module references
- NestJS API scaffold (`services/_template/`)
- Working demo app (`apps/_demo/`) for self-test
- Smoke-test script
- Base TS/ESLint/Prettier/Commitlint configs
- Security policy, SSDLC docs, deploy + mobile runbooks
- Dependabot, CODEOWNERS, PR template

## What does NOT belong

- Real app business logic (use a separate repo cloned from this template)
- Per-product config, secrets, or env files
- Speculative variants for stacks no real app uses
- Web-only concerns (those live in the sibling web `platform` template)

`apps/_demo/` and `services/_template/` exist to test the patterns, not to ship features. Keep them minimal.

## Stack conventions

- Expo (React Native) + Expo Router + TypeScript strict
- Native modules via config plugins: Swift (iOS) + Kotlin (Android)
- NestJS (App-module pattern) + TypeScript strict, on AWS Lambda + API Gateway
- Node 20+
- Postgres (Neon for serverless connection pooling)
- AWS SQS for report intake, OpenSearch for clustering similar reports
- AWS CDK for IaC
- EAS Build/Submit/Update for the app; GitHub Actions for the API
- Auth: JWT access tokens issued by the API, stored on device in expo-secure-store
- Validation: class-validator on every controller DTO; Zod where a schema is shared with the app
- Push: Expo push (APNs/FCM under the hood)
- Conventional Commits

## Style

- No em dashes anywhere (chat, code, docs, UI strings). Use comma, period, parens, or colon.
- No emojis in code or docs unless explicitly requested.
- Keep README and docs short. Lead with the answer.

## Security defaults

- Never commit secrets. `.env.local` is gitignored. Production secrets live in GitHub Actions secrets, Lambda env vars, and EAS secrets.
- Nothing secret ships in the mobile bundle. Anything in the app binary is public; keep keys server-side.
- Input validation via class-validator on every NestJS controller.
- JWT access tokens are short-lived; refresh server-side.
- TLS only: iOS App Transport Security on, Android cleartext traffic off.
- Dependabot enabled, weekly cadence.
- The IAM policy in `infra/iam/cdk-deploy-policy.json` is the least-privilege baseline for the deploy role. Use it instead of `AdministratorAccess`.

## Known production gotchas (do not relearn)

All documented in `docs/DEPLOY.md` and `docs/MOBILE.md`. Don't undo the fixes:

1. **Native call/SMS features cannot be done in JS.** iOS needs a Call Directory extension and an `ILMessageFilterExtension`; Android needs `CallScreeningService` and the call-screening / default-SMS role. These are app extensions in Swift/Kotlin, wired via Expo config plugins. The JS layer only manages data, not the native interception.
2. **`expo prebuild` is required before any native build.** The managed workflow generates `ios/` and `android/`; the native module references in `apps/_template/native/` are copied in via config plugins, not committed as generated dirs.
3. **iOS call/SMS extensions need their own App IDs, entitlements, and provisioning profiles**, separate from the main app target. Configure in EAS credentials.
4. **`EXPO_PUBLIC_*` vars are inlined into the bundle at build time** and are public. Never put secrets there. The API URL is fine; API keys are not.
5. **NestJS on Lambda must reuse the bootstrapped app across invocations.** Cache the server outside the handler or cold starts and memory balloon.
6. **API Gateway payload limit is 10 MB.** Large report attachments (images/audio) go to S3 via presigned URLs, not through the JSON body.
7. **SQS consumers must be idempotent.** Reports can be delivered more than once; dedupe on a report id.
8. **CDK env vars are baked at synth time**, not deploy time.
9. **OTA updates (EAS Update) only ship JS/asset changes.** Anything touching native code (new permissions, new extension) needs a full store build, not an OTA push.
10. **Refactoring resources into a construct changes logical IDs.** Use logical-id overrides for in-place upgrades.

## When adding a new app to a cloned repo

1. Copy `apps/_demo/` to `apps/app/` (or your name) and overlay native references from `apps/_template/`.
2. Copy `services/_template/` to `services/api/` (or your service name).
3. Rename `infra/cdk/_template/` to `infra/cdk/<your-app>/`, edit `bin/app.ts` stack id.
4. Configure GitHub secrets/vars per `docs/DEPLOY.md`, EAS per `docs/MOBILE.md`, push, verify smoke test passes.
5. Copy `apps/_template/specs/`, `apps/_template/tests/`, the jest-expo config (`jest.config.js`, `babel.config.js`), the `.maestro/` flows, `verification/`, and the test CI workflow into the new app. Wire the spec-test ESLint rule into the app's flat config. See `docs/TESTING.md`.

## Spec-driven build protocol (mandatory)

Every app on this platform is built from a spec and tested against that spec. The full system is documented in `docs/TESTING.md`. The agent protocol below is mandatory whenever you are building or extending an app.

**When the user gives you a brief for a new app:**

1. First artifact you produce is `specs/<app>.yml`. Translate the brief into requirements, each with a unique ID (`<APP>-<DOMAIN>-<NNN>`), category, severity, given/when/then. Do not write any application code yet. If the user wants to correct interpretation, they say so before code is written.
2. After the spec, for each requirement, write the `[ID]`-named test and the implementation **in the same turn**. Match the runner to the requirement's `verify` level: `unit`/`component` use jest-expo (`@platform/spec-test/jest`, RNTL for component); `e2e` uses Maestro flows ingested by `spec-maestro`; `native`/`manual` are proven by signed `verification/` artifacts (no test). The API service uses `@platform/spec-test/vitest`. (An admin web surface, if any, can use `@platform/spec-test/playwright`.)
3. Run `npm run test:spec` continuously. The build is not "done" until the gate exits 0 (100% coverage, no failing tests, no category mismatches, lint passing).
4. Never claim "the app works" without a green `test:spec`. The user should not have to ask. If the gate is red, the work is incomplete.

**When the user gives you a brief for a new feature inside an existing app:**

1. Add the new requirements to the app's `specs/<app>.yml` first. Do not extend code without a spec entry to point at.
2. Write `specTest()` and implementation in the same turn, as above.
3. **If the feature is user-facing**, write at least one journey-level e2e that traverses the full path (e.g. user-reports-scam -> API-ingests -> classifier-flags -> push-notifies), not only isolated component-level assertions. This catches the decomposed-journey trap where individual pieces are green but the chain is broken.
4. Re-run `test:spec`. Ship when green.

**When the user gives you a brief for a bug fix:**

1. If the bug points to a missing or wrong requirement in the spec, fix the spec first (or add the missing requirement).
2. Write a failing `specTest()` that captures the bug. Confirm it fails on current code.
3. Fix the code. Confirm `specTest()` passes.
4. Coverage gate stays green.

**What this prevents:**

- Shipping an app and only finding out at verification time that flows are broken. The gate refuses to deploy if any requirement is uncovered or its test is red.
- "I'll write tests later." There is no later. Tests and code ship together or not at all.
- Test-as-checkbox without assertions. The ESLint rule fails lint on any `specTest()` body that contains zero `expect()` calls.

**What this does NOT prevent:**

- A wrong spec (the test agrees with a wrong requirement). Spec correctness is on the human reviewer.
- New behavior nobody added a spec entry for. Code review catches that.
- **Decomposed-journey gaps.** A feature whose spec is split across multiple IDs can hit 100% coverage while one link in the user chain is broken. Mitigation: for every user-facing feature, ship at least one journey-level e2e that traverses the full path. On mobile this is especially sharp because the native interception (call block, SMS filter) lives outside the JS the unit tests see. See `docs/TESTING.md`.
