#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ApiStack } from "../lib/api-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1",
};

// Rename this stack id to match your app (e.g. "ScamShieldApi").
// The id becomes the CloudFormation stack name.
new ApiStack(app, "AppApi", { env });
