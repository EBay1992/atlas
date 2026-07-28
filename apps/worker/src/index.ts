import closeWithGrace from "close-with-grace";
import { loadEnv } from "@atlas/config";
import {
  createPrismaClient,
  createRedisConnection,
  MimeTextExtractor,
  OllamaEmbeddingProvider,
  PrismaChunkRepository,
  PrismaDocumentRepository,
  PrismaJobRepository,
  QdrantVectorStore,
  S3ObjectStore,
  UuidGenerator,
} from "@atlas/infra";
import {
  createLogger,
  createMetricsRegistry,
  startTracing,
  shutdownTracing,
} from "@atlas/observability";
import { createIngestionWorker } from "./processor.js";

async function main() {
  const env = loadEnv();
  await startTracing({
    enabled: env.OTEL_ENABLED,
    // Aspire AppHost sets OTEL_SERVICE_NAME to the full resource name (atlas-worker).
    serviceName: env.OTEL_SERVICE_NAME.endsWith("-worker")
      ? env.OTEL_SERVICE_NAME
      : `${env.OTEL_SERVICE_NAME}-worker`,
    environment: env.NODE_ENV,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    ...(env.OTEL_EXPORTER_OTLP_HEADERS
      ? { otlpHeaders: env.OTEL_EXPORTER_OTLP_HEADERS }
      : {}),
  });

  const logger = createLogger({
    service: "atlas-worker",
    level: env.LOG_LEVEL,
    environment: env.NODE_ENV,
  });
  const metrics = createMetricsRegistry("atlas-worker", {
    environment: env.NODE_ENV,
  });
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

  const connection = createRedisConnection({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
  });

  const { worker, dlq } = createIngestionWorker({
    logger,
    metrics,
    documents: new PrismaDocumentRepository(prisma),
    jobs: new PrismaJobRepository(prisma),
    chunks: new PrismaChunkRepository(prisma),
    objectStore,
    textExtractor: new MimeTextExtractor(),
    embeddings,
    vectorStore,
    chunkSize: env.CHUNK_SIZE,
    chunkOverlap: env.CHUNK_OVERLAP,
    embeddingBatchSize: env.EMBEDDING_BATCH_SIZE,
    ids: new UuidGenerator(),
    connection,
    queueName: env.INGESTION_QUEUE_NAME,
    dlqName: env.INGESTION_DLQ_NAME,
    concurrency: env.WORKER_CONCURRENCY,
  });

  logger.info(
    {
      queue: env.INGESTION_QUEUE_NAME,
      concurrency: env.WORKER_CONCURRENCY,
      embeddingModel: env.OLLAMA_EMBEDDING_MODEL,
      qdrant: env.QDRANT_URL,
    },
    "Atlas worker started",
  );

  closeWithGrace({ delay: 30_000 }, async ({ signal, err }) => {
    if (err) logger.error({ err }, "Worker shutting down due to error");
    else logger.info({ signal }, "Worker graceful shutdown");
    await worker.close();
    await dlq.close();
    await prisma.$disconnect();
    await shutdownTracing();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
