# mobile-platform

TypeScript platform template for shipping React Native (Expo) apps backed by a NestJS API on AWS serverless. CI/CD, IaC, security, governance, pre-canned IAM, native call/SMS module references, a verified deploy workflow, and a working demo app that proves the patterns end to end.

Designed to be cloned per-app, not vendored as a dependency. Sibling to the web `platform` template; this one covers the mobile + NestJS stack the web template deliberately excludes.

## Stack

Modeled on the real ScamShield stack (TypeScript + React + NestJS + PostgreSQL + AWS, citizen-facing iOS/Android app with call blocking, SMS filtering, check-and-report, push notifications, SQS report processing, OpenSearch clustering).

- **App:** Expo (React Native) + Expo Router, TypeScript strict
- **Native modules:** iOS Call Directory + Message Filter (Swift), Android CallScreeningService + SMS (Kotlin), surfaced through config plugins
- **API:** NestJS (TypeScript), class-validator + Zod at the boundary, JWT auth
- **Data:** PostgreSQL (Neon serverless), AWS SQS (report intake), OpenSearch (clustering)
- **Infra:** AWS Lambda + API Gateway via CDK
- **Build/deploy:** EAS Build/Submit/Update for the app, GitHub Actions + CDK for the API
- **Observability:** DataDog, push via APNs/FCM (Expo)

## What's inside

| Area | Where |
|---|---|
| CI (typecheck, lint, expo-doctor, nest build, cdk synth) | `.github/workflows/ci.yml` |
| Security scanning (CodeQL, secrets, npm audit) | `.github/workflows/security.yml` |
| Mobile build pipeline (EAS build + submit + OTA update) | `.github/workflows/mobile-build.yml` |
| API deploy pipeline (build, CDK deploy, smoke test) | `.github/workflows/deploy-api.yml` |
| Reusable CDK construct (Lambda + API Gateway + SQS + optional OpenSearch) | `infra/cdk/_template/lib/constructs/NestjsApi.ts` |
| Full CDK package scaffold (copy and rename per app) | `infra/cdk/_template/` |
| One-time AWS setup stack (OIDC + IAM role) | `infra/cdk/_setup/` |
| Pre-canned IAM policy for the deploy user/role | `infra/iam/cdk-deploy-policy.json` |
| Expo app reference overlay (native modules, push, config plugins) | `apps/_template/` |
| **Working demo app** (proves the patterns end to end) | `apps/_demo/` |
| **NestJS API service scaffold** (reports, health, SQS consumer, OpenSearch) | `services/_template/` |
| Smoke-test script (API health + auth + queue reachability) | `scripts/verify-deploy.sh` |
| **Spec-driven test system** (zod-validated YAML spec, `specTest` runner, 100% coverage gate, ESLint rule) | `packages/spec-test/` |
| Stack, security, testing, mobile guidance | `docs/`, see `docs/TESTING.md` and `docs/MOBILE.md` |
| TS/ESLint/Prettier base configs | root |
| Conventional commits + commitlint | `commitlint.config.mjs` |

## How to use

1. Create your app repo from this template:
   ```bash
   gh repo create my-app --template elleskay/mobile-platform --clone --private
   cd my-app
   ```
2. Create your real app at `apps/app/` (copy `apps/_demo/` and rename, then overlay the native module references from `apps/_template/`). The platform's `apps/_demo/` is sacred so CI's self-test keeps working; don't replace it.
3. Create your real API at `services/api/` (copy `services/_template/` and rename).
4. Rename `infra/cdk/_template/` to `infra/cdk/<your-app>/`. Edit `bin/app.ts` to match the stack id you want.
5. Run the setup CDK to provision the OIDC role: `cd infra/cdk/_setup && npm install && npx cdk deploy -c repo=<owner>/<your-app>`. Copy the output role ARN.
6. Configure AWS (OIDC + the IAM policy from `infra/iam/`), set the GitHub secrets and variables, push. The deploy workflow handles the API; EAS handles the app.

Full step-by-step in `docs/SETUP.md`, `docs/DEPLOY.md`, and `docs/MOBILE.md`. Gotchas the platform has hit are documented in `docs/DEPLOY.md`.

## Self-test

The platform's CI builds `apps/_demo/` (expo prebuild dry-run + typecheck), builds `services/_template/`, and runs `cdk synth` against the construct on every push. If anything breaks, CI fails before a cloned app picks it up.

## Opinions

- **Expo, not bare RN.** Managed workflow with config plugins for the native call/SMS modules. Maximum JS/TS reuse with the API. If you need a native capability no plugin covers, prebuild and write the module; don't fork to bare unless forced.
- **Serverless API only.** NestJS on Lambda + API Gateway. If you need always-on containers, swap the construct for Fargate; the app layer is unaffected.
- **Constructs are copied, not imported.** Each app pins its version of `NestjsApi`. Breaking changes don't propagate without explicit action.
- **The platform dogfoods itself.** `apps/_demo/` and `services/_template/` are built by the same workflows apps inherit.
- **Native call blocking and SMS filtering are platform-native, not JS.** The app reaches them through documented extension points (see `docs/MOBILE.md`); the JS layer never pretends to do what only Swift/Kotlin can.

The smaller the surface area, the fewer wrong-by-default ways apps can diverge.

## License

MIT.
