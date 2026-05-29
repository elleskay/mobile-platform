import { NestFactory } from "@nestjs/core";
import type { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from "aws-lambda";
import { AppModule } from "../app.module";
import { ReportsService } from "./reports.service";

// Separate Lambda entry point bound to the SQS report-intake queue by the CDK
// construct. Reports flow: app submits -> API enqueues -> this consumer
// classifies, indexes, persists, and notifies. Bootstrapped once and cached.
let service: ReportsService | undefined;

async function getService(): Promise<ReportsService> {
  if (service) return service;
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  const resolved = app.get(ReportsService);
  service = resolved;
  return resolved;
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const reports = await getService();
  const batchItemFailures: SQSBatchItemFailure[] = [];

  // Partial-batch response: a failed message is retried without re-running the
  // ones that succeeded. The processing is idempotent (dedupe on reportId).
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body) as {
        reportId: string;
        text: string;
        channel?: string;
      };
      await reports.process(body);
    } catch {
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
