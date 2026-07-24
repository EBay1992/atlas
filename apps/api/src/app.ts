import Fastify from "fastify";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { Env } from "@atlas/config";
import type { AppDeps } from "./types.js";
import requestContextPlugin from "./plugins/request-context.js";
import authPlugin from "./plugins/auth.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import documentsRoutes from "./routes/documents.js";
import jobsRoutes from "./routes/jobs.js";
import searchRoutes from "./routes/search.js";

export async function buildApp(_env: Env, deps: AppDeps) {
  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => deps.ids.generate(),
  });

  app.decorate("deps", deps);

  app.addHook("onRequest", async (request) => {
    request.log = deps.logger.child({
      requestId: request.id,
      correlationId:
        (request.headers["x-correlation-id"] as string | undefined) ?? request.id,
    });
  });

  app.addHook("onResponse", async (request, reply) => {
    const route = request.routeOptions.url ?? request.url;
    deps.metrics.httpRequestDuration.observe(
      {
        method: request.method,
        route,
        status_code: String(reply.statusCode),
      },
      reply.elapsedTime / 1000,
    );
    request.log.info(
      {
        method: request.method,
        route,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      "request completed",
    );
  });

  await app.register(requestContextPlugin);
  await app.register(authPlugin);
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 1,
    },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Atlas API",
        description:
          "Enterprise knowledge platform — ingestion, extraction, and semantic search",
        version: "0.2.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(documentsRoutes);
  await app.register(jobsRoutes);
  await app.register(searchRoutes);

  app.setErrorHandler((error, request, reply) => {
    const err = error as { statusCode?: number; message: string };
    request.log.error({ err: error }, "Unhandled error");
    if (reply.sent) return;
    reply.code(err.statusCode ?? 500).send({
      error: "internal_error",
      message: err.message,
    });
  });

  return app;
}
