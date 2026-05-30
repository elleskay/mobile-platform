// Root-level Lambda entry for the SQS report-intake worker.
//
// The handler MUST be at the bundle root (no slash), exactly like the HTTP entry
// `lambda.ts`. The AWS Lambda nodejs20.x runtime resolves a handler string that
// contains a slash (e.g. "reports/reports.consumer.handler") as a *bare* ESM
// specifier, so it looks for a package named "reports" in node_modules and the
// init fails with `Cannot find module 'reports'`. Re-exporting the handler from a
// root file keeps the construct's handler at "worker.handler" and sidesteps that.
export { handler } from "./reports/reports.consumer";
