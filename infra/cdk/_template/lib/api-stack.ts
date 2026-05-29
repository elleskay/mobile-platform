import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NestjsApi } from "./constructs/NestjsApi";

// Default to the conventional `services/api` location. Override via
// PLATFORM_DEMO_API_PATH so platform CI can point at the template service for
// self-test without rewriting this file.
const API_REL = process.env.PLATFORM_DEMO_API_PATH ?? "services/api";

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new NestjsApi(this, "Api", {
      servicePath: path.resolve(__dirname, "..", "..", "..", "..", API_REL),
      environment: {
        DATABASE_URL: process.env.DATABASE_URL ?? "",
        JWT_SECRET: process.env.JWT_SECRET ?? "",
        JWT_ISSUER: process.env.JWT_ISSUER ?? "mobile-platform",
        CLASSIFIER_API_URL: process.env.CLASSIFIER_API_URL ?? "",
        CLASSIFIER_API_KEY: process.env.CLASSIFIER_API_KEY ?? "",
        DD_SERVICE: process.env.DD_SERVICE ?? "mobile-platform-api",
      },
      // OpenSearch is off by default (a domain is not free). Turn on when you
      // need clustering of similar reports.
      enableOpenSearch: process.env.ENABLE_OPENSEARCH === "true",
    });
  }
}
