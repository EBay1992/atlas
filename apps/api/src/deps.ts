import type { AppDeps } from "./types.js";
import type { Env } from "@atlas/config";
import {
  BcryptPasswordHasher,
  BullMqJobQueue,
  createPrismaClient,
  createRedisConnection,
  JwtTokenService,
  OllamaEmbeddingProvider,
  PrismaChunkRepository,
  PrismaDocumentRepository,
  PrismaJobRepository,
  PrismaUserRepository,
  QdrantVectorStore,
  S3ObjectStore,
  UuidGenerator,
} from "@atlas/infra";
import { createLogger, createMetricsRegistry } from "@atlas/observability";

export async function buildDeps(env: Env): Promise<AppDeps> {
  const logger = createLogger({
    service: "atlas-api",
    level: env.LOG_LEVEL,
  });
  const metrics = createMetricsRegistry("atlas-api");
  const prisma = createPrismaClient(env.DATABASE_URL);
  const objectStore = new S3ObjectStore({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    bucket: env.S3_BUCKET,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  });
  await objectStore.ensureBucket();

  const embeddings = new OllamaEmbeddingProvider({
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_EMBEDDING_MODEL,
    dimensions: env.EMBEDDING_DIMENSIONS,
  });
  const vectorStore = new QdrantVectorStore({
    url: env.QDRANT_URL,
    collection: env.QDRANT_COLLECTION,
    dimensions: env.EMBEDDING_DIMENSIONS,
  });
  await vectorStore.ensureCollection();

  const jobQueue = new BullMqJobQueue({
    connection: createRedisConnection({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
    }),
    queueName: env.INGESTION_QUEUE_NAME,
  });

  return {
    prisma,
    logger,
    metrics,
    objectStore,
    jobQueue,
    documents: new PrismaDocumentRepository(prisma),
    jobs: new PrismaJobRepository(prisma),
    chunks: new PrismaChunkRepository(prisma),
    users: new PrismaUserRepository(prisma),
    passwordHasher: new BcryptPasswordHasher(),
    tokens: new JwtTokenService(env.JWT_SECRET, env.JWT_EXPIRES_IN),
    ids: new UuidGenerator(),
    embeddings,
    vectorStore,
  };
}
