# services/_template

NestJS API for the mobile platform (a workspace, so root `npm ci` installs its
deps and the platform CI can build it). Copy to `services/api/` and rename. Runs as
a single Lambda behind API Gateway for HTTP, plus a second Lambda bound to the
SQS report queue for async processing. Local dev runs it as a normal Nest server.

## Domains

- `health/` - liveness probe for the smoke test and API gateway.
- `reports/` - check-and-report. `POST /reports/check` classifies synchronously;
  `POST /reports` enqueues a report and returns a `reportId`.
- `reports/reports.consumer.ts` - SQS Lambda entry. Idempotent; uses partial
  batch responses so one bad message does not re-run the whole batch.
- `classifier/` - LLM scam/phishing classifier with a deterministic heuristic
  fallback (no key required to run).
- `search/` - OpenSearch client for clustering similar reports (no-ops without
  an endpoint).

## Conventions

- Every controller takes a class-validator DTO. The global `ValidationPipe` runs
  with `whitelist` + `forbidNonWhitelisted`, so unknown fields are rejected.
- Anything slow or external happens in the SQS consumer, not on the request path.
- The AWS SDK is loaded only when a queue/endpoint is configured, so local and CI
  runs need no AWS credentials.

## Run

```bash
npm install
npm run start:dev   # local server on :3000
npm run typecheck
npm run lint
npm test            # vitest + spec coverage recording
```

## Deploy

Bundled and deployed by `infra/cdk/_template` (the `NestjsApi` construct points
its HTTP Lambda at `src/lambda.ts` and its worker at `src/reports/reports.consumer.ts`).
See `docs/DEPLOY.md`.
