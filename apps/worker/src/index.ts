import closeWithGrace from "close-with-grace";
import { loadEnv } from "@atlas/config";
import {
  createPrismaClient,
  createRedisConnection,
  PrismaDocumentRepository,
  PrismaJobRepository,
  S3ObjectStore,
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
    serviceName: `${env.OTEL_SERVICE_NAME}-worker`,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  const logger = createLogger({
    service: "atlas-worker",
    level: env.LOG_LEVEL,
  });
  const metrics = createMetricsRegistry("atlas-worker");
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

  const connection = createRedisConnection({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
  });

  const { worker, dlq } = createIngestionWorker({
    logger,
    metrics,
    documents: new PrismaDocumentRepository(prisma),
    jobs: new PrismaJobRepository(prisma),
    objectStore,
    fakeProcessingMs: env.FAKE_PROCESSING_MS,
    connection,
    queueName: env.INGESTION_QUEUE_NAME,
    dlqName: env.INGESTION_DLQ_NAME,
    concurrency: env.WORKER_CONCURRENCY,
  });

  logger.info(
    {
      queue: env.INGESTION_QUEUE_NAME,
      concurrency: env.WORKER_CONCURRENCY,
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
