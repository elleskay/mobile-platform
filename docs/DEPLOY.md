# Deploy

Two pipelines: the API (GitHub Actions + CDK to AWS) and the app (EAS to the
stores / OTA). They are independent.

## API (`.github/workflows/deploy-api.yml`)

On push to `main` (or manual dispatch):

1. Preflight skips the deploy if `AWS_DEPLOY_ROLE_ARN` is unset (keeps the
   template repo and fresh forks green).
2. OIDC-assumes the deploy role. No stored AWS keys.
3. Applies DB migrations if `services/api/db/migrate.ts` exists.
4. Builds the API (`nest build`).
5. `cdk deploy --all`. The `NestjsApi` construct bundles `src/lambda.ts` and
   `src/reports/reports.consumer.ts` with esbuild.
6. Extracts the `ApiUrl` output and runs `scripts/verify-deploy.sh`.

## App (`.github/workflows/mobile-build.yml`)

Manual dispatch. Either `build` (store binary via EAS Build, optional
auto-submit) or `update` (JS-only OTA via EAS Update). Skips if `EXPO_TOKEN` is
unset. See `docs/MOBILE.md`.

## Gotchas the platform has hit (do not relearn)

1. **Native call/SMS features are not JS.** iOS needs a Call Directory extension
   and an `ILMessageFilterExtension`; Android needs `CallScreeningService` and
   the call-screening / default-SMS role. App extensions in Swift/Kotlin, wired
   via Expo config plugins.
2. **`expo prebuild` runs before any native build.** The managed workflow
   generates `ios/`+`android/`; the native references are copied in by config
   plugins, not committed.
3. **iOS extensions need their own App IDs, entitlements, and provisioning
   profiles**, separate from the main target. Configure in EAS credentials.
4. **`EXPO_PUBLIC_*` is inlined into the bundle and is public.** API URL is fine;
   API keys are not. Keep secrets server-side.
5. **NestJS on Lambda must cache the bootstrapped app** across warm invocations
   (done in `src/lambda.ts`). Re-bootstrapping per call balloons cold starts.
6. **API Gateway payload cap is 10 MB.** Large attachments go to S3 via presigned
   URLs, referenced by key, not in the JSON body.
7. **SQS consumers must be idempotent.** At-least-once delivery; dedupe on
   `reportId`. The worker uses `reportBatchItemFailures` for partial retries.
8. **CDK env vars are baked at synth time**, not deploy time.
9. **OTA updates ship JS/assets only.** Anything touching native code (new
   permission, new extension) needs a full store build, not an OTA push.
10. **Refactoring resources into a construct changes logical IDs.** Use
    `logicalIdOverrides` on `NestjsApi` for in-place upgrades.
11. **OpenSearch domains are not free and take ~15 min to create/delete.** Off by
    default (`enableOpenSearch: false`); turn on only when you need clustering.

## Rollback

API: `cdk deploy` the previous commit, or `aws cloudformation cancel-update-stack`
mid-deploy. App: promote a previous EAS build, or `eas update` a known-good JS
bundle to the channel.
