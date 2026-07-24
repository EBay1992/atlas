import type { FastifyPluginAsync } from "fastify";
import {
  assertDocumentTransition,
  assertJobTransition,
} from "@atlas/domain";
import {
  atlasSpanAttrs,
  injectTraceContext,
  withSpan,
} from "@atlas/observability";
import { serializeJob } from "./documents.js";

const jobsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/v1/jobs/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["jobs"],
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
      const job = await app.deps.jobs.findById(auth.tenantId, id);
      if (!job) {
        return reply.code(404).send({
          error: "not_found",
          message: "Job not found",
        });
      }
      return serializeJob(job);
    },
  );

  app.get(
    "/v1/jobs",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["jobs"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          required: ["documentId"],
          properties: {
            documentId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request) => {
      const auth = request.auth!;
      const { documentId } = request.query as { documentId: string };
      const jobs = await app.deps.jobs.findByDocumentId(auth.tenantId, documentId);
      return { items: jobs.map(serializeJob) };
    },
  );

  /**
   * Manual retry of a failed job — a new business action.
   * Starts a fresh Trace ID linked to the original upload via span links.
   */
  app.post(
    "/v1/jobs/:id/retry",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["jobs"],
        summary: "Manually retry a failed ingestion job",
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

      return withSpan(
        "jobs.retry",
        async () => {
          const job = await app.deps.jobs.findById(auth.tenantId, id);
          if (!job) {
            return reply.code(404).send({
              error: "not_found",
              message: "Job not found",
            });
          }
          if (job.status !== "failed") {
            return reply.code(409).send({
              error: "invalid_state",
              message: `Only failed jobs can be retried (current: ${job.status})`,
            });
          }

          const document = await app.deps.documents.findById(
            auth.tenantId,
            job.documentId,
          );
          if (!document) {
            return reply.code(404).send({
              error: "not_found",
              message: "Document not found",
            });
          }

          request.correlationId = job.documentId;
          request.log = request.log.child({
            correlationId: job.documentId,
            documentId: job.documentId,
            jobId: job.id,
            userId: auth.sub,
          });

          assertJobTransition("failed", "queued");
          const requeued = await app.deps.jobs.updateStatus(
            auth.tenantId,
            job.id,
            "failed",
            "queued",
            {
              attemptCount: 0,
              lastError: null,
              completedAt: null,
              startedAt: null,
              queueJobId: null,
            },
          );
          if (!requeued) {
            return reply.code(409).send({
              error: "conflict",
              message: "Job state changed concurrently",
            });
          }

          if (document.status === "failed") {
            assertDocumentTransition("failed", "queued");
            await app.deps.documents.updateStatus(
              auth.tenantId,
              document.id,
              "failed",
              "queued",
            );
          }

          const carrier = injectTraceContext({});
          const linkedTraceparent =
            job.linkedTraceparent ?? undefined;
          const linkedTracestate = job.linkedTracestate ?? undefined;

          try {
            const { queueJobId } = await app.deps.jobQueue.enqueueIngestion({
              jobId: job.id,
              documentId: job.documentId,
              tenantId: auth.tenantId,
              storageKey: document.storageKey,
              correlationId: job.documentId,
              userId: auth.sub,
              retryKind: "manual",
              ...(linkedTraceparent
                ? { linkedTraceparent }
                : {}),
              ...(linkedTracestate ? { linkedTracestate } : {}),
              // Fresh carrier for this retry request (not used as worker parent).
              ...(carrier["traceparent"]
                ? { traceparent: carrier["traceparent"] }
                : {}),
              ...(carrier["tracestate"]
                ? { tracestate: carrier["tracestate"] }
                : {}),
            });
            await app.deps.jobs.updateStatus(
              auth.tenantId,
              job.id,
              "queued",
              "queued",
              { queueJobId },
            );
          } catch (err) {
            request.log.error({ err }, "Failed to re-enqueue ingestion job");
            await app.deps.jobs.updateStatus(
              auth.tenantId,
              job.id,
              "queued",
              "failed",
              {
                lastError:
                  err instanceof Error ? err.message : "retry_enqueue_failed",
                completedAt: new Date(),
              },
            );
            if (document.status === "failed" || document.status === "queued") {
              const docNow = await app.deps.documents.findById(
                auth.tenantId,
                document.id,
              );
              if (docNow?.status === "queued") {
                await app.deps.documents.updateStatus(
                  auth.tenantId,
                  document.id,
                  "queued",
                  "failed",
                );
              }
            }
            return reply.code(503).send({
              error: "queue_unavailable",
              message: "Failed to enqueue retry",
            });
          }

          app.deps.metrics.jobsEnqueued.inc({ tenant_id: auth.tenantId });
          request.log.info("Manual job retry enqueued");

          const updated = await app.deps.jobs.findById(auth.tenantId, job.id);
          return reply.code(202).send({
            ...(updated ? serializeJob(updated) : serializeJob(requeued)),
            retried: true,
          });
        },
        atlasSpanAttrs({
          tenantId: auth.tenantId,
          jobId: id,
          userId: auth.sub,
        }),
      );
    },
  );
};

export default jobsRoutes;
