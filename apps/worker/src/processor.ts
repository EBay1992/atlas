import { createHash } from "node:crypto";
import { Worker, Queue, type Job } from "bullmq";
import type {
  ChunkRepository,
  DocumentRepository,
  EmbeddingProvider,
  IngestionJobPayload,
  JobRepository,
  ObjectStore,
  TextExtractor,
  VectorStore,
} from "@atlas/domain";
import {
  assertDocumentTransition,
  assertJobTransition,
  chunkText,
} from "@atlas/domain";
import type { AtlasMetrics, Logger } from "@atlas/observability";
import type { ConnectionOptions } from "bullmq";
import type { Readable } from "node:stream";

export interface ProcessorDeps {
  logger: Logger;
  metrics: AtlasMetrics;
  documents: DocumentRepository;
  jobs: JobRepository;
  chunks: ChunkRepository;
  objectStore: ObjectStore;
  textExtractor: TextExtractor;
  embeddings: EmbeddingProvider;
  vectorStore: VectorStore;
  chunkSize: number;
  chunkOverlap: number;
  embeddingBatchSize: number;
  ids: { generate(): string };
  connection: ConnectionOptions;
  queueName: string;
  dlqName: string;
  concurrency: number;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function embedInBatches(
  embeddings: EmbeddingProvider,
  texts: string[],
  batchSize: number,
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const result = await embeddings.embed(batch);
    vectors.push(...result);
  }
  return vectors;
}

export async function processIngestionJob(
  job: Job<IngestionJobPayload>,
  deps: ProcessorDeps,
): Promise<void> {
  const { jobId, documentId, tenantId, storageKey } = job.data;
  const log = deps.logger.child({
    jobId,
    documentId,
    tenantId,
    bullJobId: job.id,
    attempt: job.attemptsMade + 1,
  });
  const started = Date.now();

  log.info("Starting ingestion processing");

  const current = await deps.jobs.findById(tenantId, jobId);
  if (!current) {
    throw new Error(`Job not found: ${jobId}`);
  }
  if (current.status === "completed") {
    log.info("Job already completed; skipping");
    return;
  }
  if (current.status === "failed" && job.attemptsMade === 0) {
    log.info("Job already failed; skipping");
    return;
  }

  if (current.status === "queued") {
    assertJobTransition("queued", "processing");
    const moved = await deps.jobs.updateStatus(
      tenantId,
      jobId,
      "queued",
      "processing",
      {
        attemptCount: job.attemptsMade + 1,
        startedAt: new Date(),
        lastError: null,
      },
    );
    if (!moved) {
      log.warn("Lost optimistic lock moving job to processing");
      return;
    }
    const doc = await deps.documents.findById(tenantId, documentId);
    if (doc?.status === "queued") {
      assertDocumentTransition("queued", "processing");
      await deps.documents.updateStatus(tenantId, documentId, "queued", "processing");
    }
  } else if (current.status === "processing") {
    await deps.jobs.updateStatus(tenantId, jobId, "processing", "processing", {
      attemptCount: job.attemptsMade + 1,
    });
  }

  const document = await deps.documents.findById(tenantId, documentId);
  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  const objectStream = await deps.objectStore.getObject(storageKey);
  const body = await streamToBuffer(objectStream);
  log.info({ byteSize: body.byteLength }, "Object downloaded from object store");

  const extracted = await deps.textExtractor.extract({
    contentType: document.contentType,
    filename: document.originalFilename,
    body,
  });
  log.info(
    { pageCount: extracted.pageCount, textLength: extracted.text.length },
    "Text extracted",
  );

  const textChunks = chunkText(extracted.text, {
    size: deps.chunkSize,
    overlap: deps.chunkOverlap,
  });
  log.info({ chunkCount: textChunks.length }, "Text chunked");

  // Idempotent re-index: clear previous vectors + rows for this document
  await deps.vectorStore.deleteByDocumentId(tenantId, documentId);
  await deps.chunks.deleteByDocumentId(tenantId, documentId);

  if (textChunks.length === 0) {
    log.warn("No extractable text; completing with empty index");
  } else {
    const vectors = await embedInBatches(
      deps.embeddings,
      textChunks.map((c) => c.text),
      deps.embeddingBatchSize,
    );

    const createInputs = textChunks.map((c) => {
      const id = deps.ids.generate();
      return {
        id,
        tenantId,
        documentId,
        ordinal: c.ordinal,
        text: c.text,
        tokenEstimate: c.tokenEstimate,
        contentHash: createHash("sha256").update(c.text).digest("hex"),
      };
    });

    await deps.chunks.replaceForDocument(tenantId, documentId, createInputs);
    await deps.vectorStore.upsert(
      createInputs.map((c, i) => ({
        id: c.id,
        vector: vectors[i]!,
        payload: {
          tenantId,
          documentId,
          chunkId: c.id,
          ordinal: c.ordinal,
        },
      })),
    );
    log.info({ indexed: createInputs.length }, "Chunks indexed in Qdrant");
  }

  assertJobTransition("processing", "completed");
  const completed = await deps.jobs.updateStatus(
    tenantId,
    jobId,
    "processing",
    "completed",
    {
      completedAt: new Date(),
      lastError: null,
    },
  );
  if (!completed) {
    throw new Error("Failed to mark job completed (optimistic lock)");
  }

  const doc = await deps.documents.findById(tenantId, documentId);
  if (doc && (doc.status === "processing" || doc.status === "queued")) {
    await deps.documents.updateStatus(
      tenantId,
      documentId,
      doc.status,
      "completed",
    );
  }

  deps.metrics.jobsCompleted.inc({ tenant_id: tenantId });
  deps.metrics.workerProcessingDuration.observe(
    { outcome: "completed" },
    (Date.now() - started) / 1000,
  );
  log.info("Ingestion completed");
}

export function createIngestionWorker(deps: ProcessorDeps): {
  worker: Worker<IngestionJobPayload>;
  dlq: Queue;
} {
  const dlq = new Queue(deps.dlqName, { connection: deps.connection });

  const worker = new Worker<IngestionJobPayload>(
    deps.queueName,
    async (job) => processIngestionJob(job, deps),
    {
      connection: deps.connection,
      concurrency: deps.concurrency,
    },
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const { jobId, documentId, tenantId } = job.data;
    const log = deps.logger.child({ jobId, documentId, tenantId });
    const maxAttempts = job.opts.attempts ?? 5;
    const exhausted = job.attemptsMade >= maxAttempts;

    log.error(
      { err, attemptsMade: job.attemptsMade, exhausted },
      "Ingestion job failed",
    );

    if (exhausted) {
      const current = await deps.jobs.findById(tenantId, jobId);
      if (current && (current.status === "processing" || current.status === "queued")) {
        await deps.jobs.updateStatus(tenantId, jobId, current.status, "failed", {
          lastError: err.message,
          completedAt: new Date(),
          attemptCount: job.attemptsMade,
        });
        const doc = await deps.documents.findById(tenantId, documentId);
        if (
          doc &&
          (doc.status === "processing" ||
            doc.status === "queued" ||
            doc.status === "uploaded")
        ) {
          await deps.documents.updateStatus(
            tenantId,
            documentId,
            doc.status,
            "failed",
          );
        }
      }

      await dlq.add("dead-letter", {
        ...job.data,
        failedReason: err.message,
        attemptsMade: job.attemptsMade,
      });
      deps.metrics.jobsFailed.inc({ tenant_id: tenantId });
      deps.metrics.workerProcessingDuration.observe({ outcome: "failed" }, 0);
    }
  });

  return { worker, dlq };
}
