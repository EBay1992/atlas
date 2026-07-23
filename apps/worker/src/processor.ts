import { Worker, Queue, type Job } from "bullmq";
import type {
  DocumentRepository,
  IngestionJobPayload,
  JobRepository,
  ObjectStore,
} from "@atlas/domain";
import { assertDocumentTransition, assertJobTransition } from "@atlas/domain";
import type { AtlasMetrics, Logger } from "@atlas/observability";
import type { ConnectionOptions } from "bullmq";

export interface ProcessorDeps {
  logger: Logger;
  metrics: AtlasMetrics;
  documents: DocumentRepository;
  jobs: JobRepository;
  objectStore: ObjectStore;
  fakeProcessingMs: number;
  connection: ConnectionOptions;
  queueName: string;
  dlqName: string;
  concurrency: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  log.info("Starting fake ingestion processing");

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

  // Prove object storage wiring
  const head = await deps.objectStore.headObject(storageKey);
  log.info({ contentLength: head.contentLength }, "Object verified in MinIO");

  const stepMs = Math.max(1, Math.floor(deps.fakeProcessingMs / 3));
  for (const step of ["normalize", "index-stub", "finalize"] as const) {
    log.info({ step }, "Fake processing step");
    await sleep(stepMs);
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
  log.info("Fake ingestion completed");
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
