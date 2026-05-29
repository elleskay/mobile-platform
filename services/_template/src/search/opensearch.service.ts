import { Injectable, Logger } from "@nestjs/common";

export interface IndexedReport {
  id: string;
  text: string;
  verdict: string;
  createdAt: string;
}

/**
 * Indexes scam reports into OpenSearch and groups similar messages (the real
 * ScamShield uses OpenSearch for clustering similar scam messages). No-ops
 * cleanly when OPENSEARCH_ENDPOINT is unset so the API runs locally and in CI
 * without a cluster. Swap the fetch calls for @opensearch-project/opensearch
 * with SigV4 signing in production.
 */
@Injectable()
export class OpenSearchService {
  private readonly logger = new Logger(OpenSearchService.name);
  private readonly endpoint = process.env.OPENSEARCH_ENDPOINT;
  private readonly indexName = "scam-reports";

  get enabled(): boolean {
    return Boolean(this.endpoint);
  }

  async index(report: IndexedReport): Promise<void> {
    if (!this.enabled) {
      this.logger.debug("OpenSearch disabled; skipping index.");
      return;
    }
    await fetch(`${this.endpoint}/${this.indexName}/_doc/${report.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
    });
  }

  /** Returns ids of reports whose text is similar to the given one. */
  async findSimilar(text: string, limit = 10): Promise<string[]> {
    if (!this.enabled) return [];
    const res = await fetch(`${this.endpoint}/${this.indexName}/_search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        size: limit,
        query: { match: { text: { query: text, fuzziness: "AUTO" } } },
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { hits?: { hits?: { _id: string }[] } };
    return (data.hits?.hits ?? []).map((h) => h._id);
  }
}
