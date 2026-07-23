import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { randomUUID } from "node:crypto";

const requestContextPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    const requestId =
      (request.headers["x-request-id"] as string | undefined) ?? randomUUID();
    const correlationId =
      (request.headers["x-correlation-id"] as string | undefined) ?? requestId;
    request.requestId = requestId;
    request.correlationId = correlationId;
    reply.header("x-request-id", requestId);
    reply.header("x-correlation-id", correlationId);
  });
};

export default fp(requestContextPlugin, { name: "request-context" });
