#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { SetupStack } from "../lib/setup-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1",
};

// Required: tell the stack which GitHub repo to trust.
// Pass via context: cdk deploy -c repo=elleskay/armoury
const repo = app.node.tryGetContext("repo") as string | undefined;
if (!repo) {
  throw new Error(
    "Missing required context 'repo'. Pass it via -c repo=<owner>/<name>, e.g. -c repo=elleskay/armoury",
  );
}

if (!/^[^/]+\/[^/]+$/.test(repo)) {
  throw new Error(`Context 'repo' must be '<owner>/<name>', got '${repo}'`);
}

const roleName = (app.node.tryGetContext("roleName") as string | undefined) ?? `github-actions-${repo.split("/")[1]}`;

new SetupStack(app, `PlatformSetup-${repo.replace("/", "-")}`, {
  env,
  repo,
  roleName,
});
