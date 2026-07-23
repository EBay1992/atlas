import { createHash, type Hash } from "node:crypto";
import { Transform, type TransformCallback } from "node:stream";
import type { FastifyPluginAsync } from "fastify";

function serializeDocument(doc: {
  id: string;
  tenantId: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  storageKey: string;
  status: string;
  checksumSha256: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    originalFilename: doc.originalFilename,
    contentType: doc.contentType,
    byteSize: doc.byteSize,
    storageKey: doc.storageKey,
    status: doc.status,
    checksumSha256: doc.checksumSha256,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function serializeJob(job: {
  id: string;
  tenantId: string;
  documentId: string;
  queueJobId: string | null;
  status: string;
  attemptCount: number;
  lastError: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: job.id,
    tenantId: job.tenantId,
    documentId: job.documentId,
    queueJobId: job.queueJobId,
    status: job.status,
    attemptCount: job.attemptCount,
    lastError: job.lastError,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    idempotencyKey: job.idempotencyKey,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

class HashingCounter extends Transform {
  byteSize = 0;
  private readonly hash: Hash;

  constructor() {
    super();
    this.hash = createHash("sha256");
  }

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.byteSize += chunk.length;
    this.hash.update(chunk);
    callback(null, chunk);
  }

  digest(): string {
    return this.hash.digest("hex");
  }
}

const documentsRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/v1/documents",
    {
      preHandler: [app.authenticate],
      // Body schema is for OpenAPI/Swagger file picker; multipart body is not JSON,
      // so we attach validation errors instead of failing the request.
      attachValidation: true,
      schema: {
        tags: ["documents"],
        summary: "Upload a document",
        description:
          "Multipart upload. In Swagger UI, choose a file under **Request body → file**.",
        security: [{ bearerAuth: [] }],
        headers: {
          type: "object",
          properties: {
            "idempotency-key": {
              type: "string",
              description:
                "Optional. Same key + tenant returns the existing document/job.",
            },
          },
        },
        consumes: ["multipart/form-data"],
        body: {
          type: "object",
          required: ["file"],
          properties: {
            file: {
              type: "string",
              contentEncoding: "binary",
              description: "Document file to ingest",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const auth = request.auth!;
      const idempotencyKeyHeader = request.headers["idempotency-key"];
      const idempotencyKey =
        typeof idempotencyKeyHeader === "string" && idempotencyKeyHeader.length > 0
          ? idempotencyKeyHeader
          : null;

      if (idempotencyKey) {
        const existing = await app.deps.jobs.findByIdempotencyKey(
          auth.tenantId,
          idempotencyKey,
        );
        if (existing) {
          return reply.code(202).send({
            documentId: existing.documentId,
            jobId: existing.id,
            status: existing.status,
            reused: true,
          });
        }
      }

      const file = await request.file();
      if (!file) {
        return reply.code(400).send({
          error: "bad_request",
          message: "Expected multipart file field named 'file'",
        });
      }

      const documentId = app.deps.ids.generate();
      const jobId = app.deps.ids.generate();
      const storageKey = `${auth.tenantId}/${documentId}/${file.filename}`;
      const hasher = new HashingCounter();
      const uploadStream = file.file.pipe(hasher);

      // Dual-write order: object store → DB metadata → queue.
      // Orphaned objects possible if DB fails after MinIO write (compensating delete).
      try {
        await app.deps.objectStore.putObject({
          key: storageKey,
          body: uploadStream,
          contentType: file.mimetype || "application/octet-stream",
        });
      } catch (err) {
        request.log.error({ err }, "Failed to upload object to MinIO");
        return reply.code(502).send({
          error: "storage_error",
          message: "Failed to store document bytes",
        });
      }

      const byteSize = hasher.byteSize;
      const checksumSha256 = hasher.digest();

      let document;
      let job;
      try {
        document = await app.deps.documents.create({
          id: documentId,
          tenantId: auth.tenantId,
          originalFilename: file.filename,
          contentType: file.mimetype || "application/octet-stream",
          byteSize,
          storageKey,
          status: "uploaded",
          checksumSha256,
        });

        job = await app.deps.jobs.create({
          id: jobId,
          tenantId: auth.tenantId,
          documentId,
          status: "queued",
          idempotencyKey,
        });
      } catch (err) {
        try {
          await app.deps.objectStore.deleteObject(storageKey);
        } catch {
          /* ignore compensation failure */
        }
        request.log.error({ err }, "Failed to persist document/job metadata");

        if (
          idempotencyKey &&
          err instanceof Error &&
          /unique|Unique constraint/i.test(err.message)
        ) {
          const existing = await app.deps.jobs.findByIdempotencyKey(
            auth.tenantId,
            idempotencyKey,
          );
          if (existing) {
            return reply.code(202).send({
              documentId: existing.documentId,
              jobId: existing.id,
              status: existing.status,
              reused: true,
            });
          }
        }

        return reply.code(500).send({
          error: "persistence_error",
          message: "Failed to persist document metadata",
        });
      }

      await app.deps.documents.updateStatus(
        auth.tenantId,
        document.id,
        "uploaded",
        "queued",
      );

      try {
        const traceparentHeader = request.headers["traceparent"];
        const { queueJobId } = await app.deps.jobQueue.enqueueIngestion({
          jobId: job.id,
          documentId: document.id,
          tenantId: auth.tenantId,
          storageKey,
          ...(typeof traceparentHeader === "string"
            ? { traceparent: traceparentHeader }
            : {}),
        });
        await app.deps.jobs.updateStatus(auth.tenantId, job.id, "queued", "queued", {
          queueJobId,
        });
      } catch (err) {
        request.log.error({ err }, "Failed to enqueue ingestion job");
        await app.deps.jobs.updateStatus(auth.tenantId, job.id, "queued", "failed", {
          lastError: err instanceof Error ? err.message : "enqueue_failed",
          completedAt: new Date(),
        });
        await app.deps.documents.updateStatus(
          auth.tenantId,
          document.id,
          "queued",
          "failed",
        );
        app.deps.metrics.jobsFailed.inc({ tenant_id: auth.tenantId });
        return reply.code(503).send({
          error: "queue_unavailable",
          message: "Document stored but failed to enqueue processing",
          documentId: document.id,
          jobId: job.id,
          status: "failed",
        });
      }

      app.deps.metrics.uploadBytes.inc({ tenant_id: auth.tenantId }, byteSize);
      app.deps.metrics.jobsEnqueued.inc({ tenant_id: auth.tenantId });

      request.log.info(
        {
          documentId: document.id,
          jobId: job.id,
          tenantId: auth.tenantId,
          byteSize,
        },
        "Document uploaded and enqueued",
      );

      return reply.code(202).send({
        documentId: document.id,
        jobId: job.id,
        status: "queued",
        reused: false,
      });
    },
  );

  app.get(
    "/v1/documents/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["documents"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request, reply) => {
      const auth = request.auth!;
      const { id } = request.params as { id: string };
      const doc = await app.deps.documents.findById(auth.tenantId, id);
      if (!doc) {
        return reply.code(404).send({
          error: "not_found",
          message: "Document not found",
        });
      }
      return serializeDocument(doc);
    },
  );
};

export default documentsRoutes;
export { serializeDocument, serializeJob };
