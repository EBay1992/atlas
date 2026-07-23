import type { FastifyPluginAsync } from "fastify";

const searchRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/v1/search",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["search"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string", minLength: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
            documentId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    documentId: { type: "string" },
                    chunkId: { type: "string" },
                    ordinal: { type: "integer" },
                    text: { type: "string" },
                    filename: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const auth = request.auth!;
      const body = request.body as {
        query: string;
        limit?: number;
        documentId?: string;
      };
      const limit = body.limit ?? 10;

      const [queryVector] = await app.deps.embeddings.embed([body.query]);
      if (!queryVector) {
        return { results: [] };
      }

      const hits = await app.deps.vectorStore.search({
        vector: queryVector,
        tenantId: auth.tenantId,
        limit,
        ...(body.documentId ? { documentId: body.documentId } : {}),
      });

      const chunkIds = hits.map((h) => h.payload.chunkId);
      const chunks = await app.deps.chunks.findByIds(auth.tenantId, chunkIds);
      const chunkById = new Map(chunks.map((c) => [c.id, c]));

      const documentIds = [
        ...new Set(hits.map((h) => h.payload.documentId)),
      ];
      const documents = await Promise.all(
        documentIds.map((id) =>
          app.deps.documents.findById(auth.tenantId, id),
        ),
      );
      const filenameByDoc = new Map(
        documents
          .filter((d): d is NonNullable<typeof d> => d != null)
          .map((d) => [d.id, d.originalFilename]),
      );

      return {
        results: hits.map((hit) => {
          const chunk = chunkById.get(hit.payload.chunkId);
          return {
            score: hit.score,
            documentId: hit.payload.documentId,
            chunkId: hit.payload.chunkId,
            ordinal: hit.payload.ordinal,
            text: chunk?.text ?? "",
            filename: filenameByDoc.get(hit.payload.documentId) ?? null,
          };
        }),
      };
    },
  );
};

export default searchRoutes;
