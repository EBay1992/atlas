import type { FastifyPluginAsync } from "fastify";
import { pingPrisma } from "@atlas/infra";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/health/live",
    {
      schema: {
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: { status: { type: "string" } },
          },
        },
      },
    },
    async () => ({ status: "ok" }),
  );

  app.get(
    "/health/ready",
    {
      schema: {
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              checks: {
                type: "object",
                additionalProperties: { type: "string" },
              },
            },
          },
          503: {
            type: "object",
            properties: {
              status: { type: "string" },
              checks: {
                type: "object",
                additionalProperties: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const checks: Record<string, string> = {};
      let ok = true;

      try {
        await pingPrisma(app.deps.prisma);
        checks.postgres = "ok";
      } catch (err) {
        ok = false;
        checks.postgres = err instanceof Error ? err.message : "error";
      }

      try {
        await app.deps.jobQueue.ping();
        checks.redis = "ok";
      } catch (err) {
        ok = false;
        checks.redis = err instanceof Error ? err.message : "error";
      }

      try {
        await app.deps.objectStore.ping();
        checks.minio = "ok";
      } catch (err) {
        ok = false;
        checks.minio = err instanceof Error ? err.message : "error";
      }

      return reply.code(ok ? 200 : 503).send({
        status: ok ? "ready" : "not_ready",
        checks,
      });
    },
  );

  app.get("/metrics", async (_request, reply) => {
    reply.header("content-type", app.deps.metrics.registry.contentType);
    return app.deps.metrics.registry.metrics();
  });
};

export default healthRoutes;
