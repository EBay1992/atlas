import { QdrantClient } from "@qdrant/js-client-rest";
import type {
  VectorPoint,
  VectorSearchHit,
  VectorSearchInput,
  VectorStore,
} from "@atlas/domain";

export interface QdrantVectorStoreOptions {
  url: string;
  collection: string;
  dimensions: number;
}

export class QdrantVectorStore implements VectorStore {
  private readonly client: QdrantClient;
  private readonly collection: string;
  private readonly dimensions: number;

  constructor(options: QdrantVectorStoreOptions) {
    this.client = new QdrantClient({
      url: options.url,
      checkCompatibility: false,
    });
    this.collection = options.collection;
    this.dimensions = options.dimensions;
  }

  async ensureCollection(): Promise<void> {
    try {
      await this.client.getCollection(this.collection);
      return;
    } catch {
      // Collection missing — create below
    }

    try {
      await this.client.createCollection(this.collection, {
        vectors: {
          size: this.dimensions,
          distance: "Cosine",
        },
      });
    } catch (err) {
      const status = (err as { status?: number }).status;
      const message = err instanceof Error ? err.message : String(err);
      // Another process may have created it concurrently
      if (status !== 409 && !/already exists/i.test(message)) {
        throw err;
      }
    }

    try {
      await this.client.createPayloadIndex(this.collection, {
        field_name: "tenantId",
        field_schema: "keyword",
      });
    } catch {
      // Index may already exist
    }
    try {
      await this.client.createPayloadIndex(this.collection, {
        field_name: "documentId",
        field_schema: "keyword",
      });
    } catch {
      // Index may already exist
    }
  }

  async upsert(points: VectorPoint[]): Promise<void> {
    if (points.length === 0) return;
    await this.client.upsert(this.collection, {
      wait: true,
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    });
  }

  async search(input: VectorSearchInput): Promise<VectorSearchHit[]> {
    const must: Array<Record<string, unknown>> = [
      { key: "tenantId", match: { value: input.tenantId } },
    ];
    if (input.documentId) {
      must.push({ key: "documentId", match: { value: input.documentId } });
    }

    const result = await this.client.search(this.collection, {
      vector: input.vector,
      limit: input.limit,
      with_payload: true,
      filter: { must },
    });

    return result.map((hit) => {
      const payload = (hit.payload ?? {}) as Record<string, unknown>;
      return {
        id: String(hit.id),
        score: hit.score,
        payload: {
          tenantId: String(payload["tenantId"] ?? ""),
          documentId: String(payload["documentId"] ?? ""),
          chunkId: String(payload["chunkId"] ?? hit.id),
          ordinal: Number(payload["ordinal"] ?? 0),
        },
      };
    });
  }

  async deleteByDocumentId(
    tenantId: string,
    documentId: string,
  ): Promise<void> {
    await this.client.delete(this.collection, {
      wait: true,
      filter: {
        must: [
          { key: "tenantId", match: { value: tenantId } },
          { key: "documentId", match: { value: documentId } },
        ],
      },
    });
  }

  async ping(): Promise<void> {
    await this.client.getCollections();
  }
}
