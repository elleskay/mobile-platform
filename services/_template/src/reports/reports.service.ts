import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ClassifierService, type Classification } from "../classifier/classifier.service";
import { OpenSearchService } from "../search/opensearch.service";
import type { CreateReportDto } from "./dto/create-report.dto";

export interface ReportReceipt {
  reportId: string;
  status: "queued";
}

/**
 * Check-and-report domain. `check` classifies a message synchronously for the
 * app. `submit` enqueues a report onto SQS for async processing (the real
 * ScamShield uses SQS for auto-report consumption). The heavy work (persist,
 * index, notify) happens in the SQS consumer, not on the request path.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly queueUrl = process.env.REPORTS_QUEUE_URL;

  constructor(
    private readonly classifier: ClassifierService,
    private readonly search: OpenSearchService,
  ) {}

  async check(text: string): Promise<Classification> {
    return this.classifier.classify(text);
  }

  async submit(dto: CreateReportDto): Promise<ReportReceipt> {
    const reportId = randomUUID();
    await this.enqueue({ reportId, ...dto });
    return { reportId, status: "queued" };
  }

  /**
   * Processes one report from the queue. Must be idempotent: SQS can deliver a
   * message more than once, so dedupe on reportId (CLAUDE.md gotcha #7).
   */
  async process(message: { reportId: string; text: string; channel?: string }): Promise<void> {
    const classification = await this.classifier.classify(message.text);
    await this.search.index({
      id: message.reportId,
      text: message.text,
      verdict: classification.verdict,
      createdAt: new Date().toISOString(),
    });
    // TODO(app): persist to Postgres, and if verdict is scam, send a push
    // notification to the reporter (the real app notifies when a report is
    // marked a scam).
    this.logger.log(
      `processed report ${message.reportId}: ${classification.verdict} (${classification.source})`,
    );
  }

  private async enqueue(payload: Record<string, unknown>): Promise<void> {
    if (!this.queueUrl) {
      // Local / CI: no queue. Process inline so the flow still works end to end.
      this.logger.debug("REPORTS_QUEUE_URL unset; processing inline.");
      await this.process(payload as { reportId: string; text: string });
      return;
    }
    // Production: send to SQS. Uses the AWS SDK v3 (bundled at deploy).
    const { SQSClient, SendMessageCommand } = await import("@aws-sdk/client-sqs");
    const client = new SQSClient({});
    await client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(payload),
      }),
    );
  }
}
