# infra/cdk/\_template

CDK package for the NestJS API. Copy to `infra/cdk/<your-app>/` and rename the
stack id in `bin/app.ts`.

## What it deploys (`NestjsApi` construct)

- HTTP Lambda (`src/lambda.ts`, serverless-express) behind an API Gateway HTTP API
- SQS report-intake queue plus a dead-letter queue
- Worker Lambda (`src/worker.ts`, a root re-export of
  `src/reports/reports.consumer.ts`) consuming the queue with partial-batch
  responses
- Optional OpenSearch domain for clustering similar reports (`enableOpenSearch`)

`REPORTS_QUEUE_URL` and `OPENSEARCH_ENDPOINT` are injected into the Lambdas by the
construct. Pass the rest (DATABASE_URL, JWT_SECRET, classifier keys) via the
`environment` prop. Env vars are baked at synth time.

## Commands

```bash
npm install
npm run synth     # cdk synth
npm run diff
npm run deploy    # cdk deploy --all
```

Set `CDK_DEFAULT_ACCOUNT`, `CDK_DEFAULT_REGION`, and the service env vars in the
shell that runs deploy. CI does this via OIDC; see `docs/DEPLOY.md`.

## Gotchas baked in

- The Lambda asset is the `nest build` output plus production `node_modules`,
  deliberately not an esbuild bundle: bundling drops the decorator metadata
  NestJS DI needs, and the app would boot with every injected service undefined.
- The AWS SDK v3 is not shipped (dev-only dependency); the Node 22 Lambda
  runtime provides it.
- Nest app cached across warm invocations (in the service's `lambda.ts`).
- SQS worker is idempotent and uses `reportBatchItemFailures`.
- Use `logicalIdOverrides` for in-place upgrades when adopting the construct on a
  stack that previously created these resources at the root.
