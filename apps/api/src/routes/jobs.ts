import type { FastifyPluginAsync } from "fastify";
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
};

export default jobsRoutes;
