import type { FastifyPluginAsync } from "fastify";

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/v1/auth/login",
    {
      schema: {
        tags: ["auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              accessToken: { type: "string" },
              tokenType: { type: "string" },
              expiresIn: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { email: string; password: string };
      const user = await app.deps.users.findByEmail(body.email.toLowerCase());
      if (!user) {
        return reply.code(401).send({
          error: "unauthorized",
          message: "Invalid credentials",
        });
      }
      const valid = await app.deps.passwordHasher.verify(
        body.password,
        user.passwordHash,
      );
      if (!valid) {
        return reply.code(401).send({
          error: "unauthorized",
          message: "Invalid credentials",
        });
      }

      const accessToken = await app.deps.tokens.sign({
        sub: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
      });

      return {
        accessToken,
        tokenType: "Bearer",
        expiresIn: "1h",
      };
    },
  );
};

export default authRoutes;
