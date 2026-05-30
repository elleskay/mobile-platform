import * as path from "path";
import { execSync } from "child_process";
import * as fs from "fs";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as opensearch from "aws-cdk-lib/aws-opensearchservice";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export interface NestjsApiProps {
  /**
   * Path to the NestJS service directory. Must contain `src/lambda.ts` (HTTP
   * handler) and `src/reports/reports.consumer.ts` (SQS worker).
   */
  readonly servicePath: string;

  /**
   * Monorepo root for esbuild bundling (where the root package-lock.json lives).
   * Defaults to two levels above `servicePath` (the `services/<name>` layout).
   * Override if your service sits elsewhere.
   */
  readonly monorepoRoot?: string;

  /**
   * Environment variables set on both Lambdas. Include DATABASE_URL, JWT_SECRET,
   * and any classifier/observability keys. REPORTS_QUEUE_URL and
   * OPENSEARCH_ENDPOINT are injected by the construct, do not set them here.
   */
  readonly environment?: Record<string, string>;

  /** Memory for the HTTP Lambda. Default 512. */
  readonly httpMemoryMb?: number;

  /** Memory for the SQS worker Lambda. Default 1024. */
  readonly workerMemoryMb?: number;

  /** Log retention. Default 14 days. */
  readonly logRetention?: logs.RetentionDays;

  /**
   * Provision an OpenSearch domain for clustering similar reports. Off by
   * default because a domain is not free. When true, OPENSEARCH_ENDPOINT is set
   * on the worker Lambda automatically.
   */
  readonly enableOpenSearch?: boolean;

  /**
   * Preserve CloudFormation logical IDs for in-place upgrades. Maps
   * "httpFunction" | "workerFunction" | "queue" to original logical IDs to avoid
   * destroy+recreate (CLAUDE.md gotcha #10).
   */
  readonly logicalIdOverrides?: {
    httpFunction?: string;
    workerFunction?: string;
    queue?: string;
  };
}

/**
 * Deploys a NestJS API as a serverless stack:
 *  - HTTP Lambda (serverless-express) behind an API Gateway HTTP API
 *  - SQS report-intake queue + DLQ
 *  - Worker Lambda consuming the queue with partial-batch responses
 *  - Optional OpenSearch domain for clustering
 *
 * Encodes the gotchas you would otherwise learn in production:
 *  - The Nest app is bootstrapped once and cached across warm invocations
 *    (handled in the service's src/lambda.ts).
 *  - SQS consumers must be idempotent; the worker uses reportBatchItemFailures.
 *  - Large attachments go to S3 via presigned URLs, not the 10 MB API body.
 *  - Env vars are baked at synth time; pass them via `environment`.
 */
export class NestjsApi extends Construct {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly queue: sqs.Queue;
  public readonly httpFunction: lambda.Function;
  public readonly workerFunction: lambda.Function;
  public readonly domain?: opensearch.Domain;

  constructor(scope: Construct, id: string, props: NestjsApiProps) {
    super(scope, id);

    const retention = props.logRetention ?? logs.RetentionDays.TWO_WEEKS;
    const overrides = props.logicalIdOverrides ?? {};
    const baseEnv = props.environment ?? {};

    const deadLetterQueue = new sqs.Queue(this, "ReportsDlq", {
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    this.queue = new sqs.Queue(this, "ReportsQueue", {
      visibilityTimeout: cdk.Duration.seconds(60),
      enforceSSL: true,
      deadLetterQueue: { queue: deadLetterQueue, maxReceiveCount: 5 },
    });
    if (overrides.queue) {
      (this.queue.node.defaultChild as cdk.CfnResource).overrideLogicalId(overrides.queue);
    }

    if (props.enableOpenSearch) {
      this.domain = new opensearch.Domain(this, "ScamSearch", {
        version: opensearch.EngineVersion.OPENSEARCH_2_13,
        capacity: { dataNodes: 1, dataNodeInstanceType: "t3.small.search" },
        ebs: { volumeSize: 10, volumeType: ec2.EbsDeviceVolumeType.GP3 },
        nodeToNodeEncryption: true,
        encryptionAtRest: { enabled: true },
        enforceHttps: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    }

    // Build the service for Lambda once, at synth time: `nest build` (tsc, which
    // emits the decorator metadata NestJS DI needs) plus production node_modules.
    // We deliberately do NOT esbuild-bundle: esbuild drops emitDecoratorMetadata
    // and reorders modules, which silently breaks constructor injection in the
    // bundle (the app boots but every injected service is undefined at runtime).
    // Shipping the tsc output + node_modules keeps require-order and metadata
    // correct. The asset is larger but the API actually works.
    const stage = path.join(props.servicePath, ".lambda-bundle");
    fs.rmSync(stage, { recursive: true, force: true });
    fs.mkdirSync(stage, { recursive: true });
    execSync("npm run build", { cwd: props.servicePath, stdio: "inherit" });
    fs.cpSync(path.join(props.servicePath, "dist"), stage, { recursive: true });
    // Write a prod-only package.json (strip devDependencies + scripts). npm
    // resolves dev deps before --omit=dev prunes them, and a dev dep like
    // @platform/spec-test ("*") is a workspace package that 404s from the
    // registry, so it must not be in the manifest we install from.
    const pkg = JSON.parse(
      fs.readFileSync(path.join(props.servicePath, "package.json"), "utf8"),
    ) as Record<string, unknown>;
    delete pkg.devDependencies;
    delete pkg.scripts;
    fs.writeFileSync(path.join(stage, "package.json"), JSON.stringify(pkg, null, 2));
    // Production deps only. The AWS SDK v3 is provided by the Lambda runtime.
    execSync("npm install --omit=dev --no-package-lock --no-audit --no-fund", {
      cwd: stage,
      stdio: "inherit",
    });

    const commonFn = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        NODE_ENV: "production",
        ...baseEnv,
        REPORTS_QUEUE_URL: this.queue.queueUrl,
        ...(this.domain ? { OPENSEARCH_ENDPOINT: `https://${this.domain.domainEndpoint}` } : {}),
      },
    };

    this.httpFunction = new lambda.Function(this, "HttpFunction", {
      ...commonFn,
      code: lambda.Code.fromAsset(stage),
      handler: "lambda.handler",
      memorySize: props.httpMemoryMb ?? 512,
      timeout: cdk.Duration.seconds(29),
      logGroup: new logs.LogGroup(this, "HttpLogs", {
        retention,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });
    if (overrides.httpFunction) {
      (this.httpFunction.node.defaultChild as cdk.CfnResource).overrideLogicalId(
        overrides.httpFunction,
      );
    }

    this.workerFunction = new lambda.Function(this, "WorkerFunction", {
      ...commonFn,
      code: lambda.Code.fromAsset(stage),
      handler: "reports/reports.consumer.handler",
      memorySize: props.workerMemoryMb ?? 1024,
      timeout: cdk.Duration.seconds(60),
      logGroup: new logs.LogGroup(this, "WorkerLogs", {
        retention,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });
    if (overrides.workerFunction) {
      (this.workerFunction.node.defaultChild as cdk.CfnResource).overrideLogicalId(
        overrides.workerFunction,
      );
    }

    // HTTP Lambda enqueues; worker consumes.
    this.queue.grantSendMessages(this.httpFunction);
    this.workerFunction.addEventSource(
      new SqsEventSource(this.queue, {
        batchSize: 10,
        reportBatchItemFailures: true,
        maxBatchingWindow: cdk.Duration.seconds(5),
      }),
    );
    if (this.domain) {
      this.domain.grantWrite(this.workerFunction);
      this.domain.grantRead(this.httpFunction);
    }

    this.httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      defaultIntegration: new HttpLambdaIntegration("HttpIntegration", this.httpFunction),
    });

    new cdk.CfnOutput(cdk.Stack.of(this), `${id}ApiUrl`, {
      value: this.httpApi.apiEndpoint,
      description: "Public API base URL. Set as EXPO_PUBLIC_API_URL for the app.",
    });
    new cdk.CfnOutput(cdk.Stack.of(this), `${id}QueueUrl`, {
      value: this.queue.queueUrl,
      description: "Report intake queue URL.",
    });
    if (this.domain) {
      new cdk.CfnOutput(cdk.Stack.of(this), `${id}OpenSearchEndpoint`, {
        value: this.domain.domainEndpoint,
        description: "OpenSearch domain endpoint.",
      });
    }
  }
}
