import type { AuthClaims, UserRole } from "@atlas/domain";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.code(401).send({
      error: "unauthorized",
      message: "Missing Bearer token",
    });
  }
  const token = header.slice("Bearer ".length);
  try {
    const claims = await request.server.deps.tokens.verify(token);
    request.auth = {
      sub: claims.sub,
      tenantId: claims.tenantId,
      email: claims.email,
      role: claims.role as UserRole,
    } satisfies AuthClaims;
  } catch {
    return reply.code(401).send({
      error: "unauthorized",
      message: "Invalid or expired token",
    });
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorate("authenticate", authenticate);
};

declare module "fastify" {
  interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}

export default fp(authPlugin, { name: "auth" });
export { authenticate };
