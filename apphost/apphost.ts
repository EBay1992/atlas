/**
 * Atlas Aspire AppHost — local development control plane.
 *
 * RULES:
 * - Orchestration + resource graph + OTel dashboard wiring ONLY.
 * - Never import Aspire from apps/* or packages/domain|infra.
 * - Apps keep reading standard env vars via @atlas/config.
 * - Removing this folder must leave Compose + pnpm workflows intact.
 *
 * Prerequisites:
 *   1. Install Aspire CLI: https://aspire.dev/get-started/install-cli/
 *   2. cd apphost && aspire restore   # generates .aspire/modules
 *   3. aspire run   # or: pnpm aspire:run from repo root
 *
 * Ollama stays on the host (not orchestrated here), same as Docker Compose.
 */
import {
  createBuilder,
  EndpointProperty,
} from "./.aspire/modules/aspire.mjs";

const builder = await createBuilder();

const postgres = await builder.addPostgres("postgres");
const atlasDb = await postgres.addDatabase("atlas");
const redis = await builder.addRedis("redis");

const minio = await builder
  .addContainer("minio", "minio/minio:latest")
  .withHttpEndpoint({ targetPort: 9000, name: "s3" })
  .withHttpEndpoint({ targetPort: 9001, name: "console" })
  .withArgs(["server", "/data", "--console-address", ":9001"])
  .withEnvironment("MINIO_ROOT_USER", "atlasminio")
  .withEnvironment("MINIO_ROOT_PASSWORD", "atlasminio");

const qdrant = await builder
  .addContainer("qdrant", "qdrant/qdrant:v1.14.1")
  .withHttpEndpoint({ targetPort: 6333, name: "http" });

const postgresTcp = await postgres.getEndpoint("tcp");
const redisTcp = await redis.getEndpoint("tcp");
const minioS3 = await minio.getEndpoint("s3");
const qdrantHttp = await qdrant.getEndpoint("http");

const postgresHost = await postgresTcp.property(EndpointProperty.Host);
const postgresPort = await postgresTcp.property(EndpointProperty.Port);
const redisHost = await redisTcp.property(EndpointProperty.Host);
const redisPort = await redisTcp.property(EndpointProperty.Port);
const minioHost = await minioS3.property(EndpointProperty.Host);
const minioPort = await minioS3.property(EndpointProperty.Port);
const qdrantHost = await qdrantHttp.property(EndpointProperty.Host);
const qdrantPort = await qdrantHttp.property(EndpointProperty.Port);

async function wireAtlasService(
  // Fluent Aspire resource — typed after `aspire restore`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app: any,
  otelServiceName: string,
) {
  return app
    .withReference(atlasDb)
    .withReference(redis)
    .waitFor(atlasDb)
    .waitFor(redis)
    .waitFor(minio)
    .waitFor(qdrant)
    .withEnvironment("POSTGRES_HOST", postgresHost)
    .withEnvironment("POSTGRES_PORT", postgresPort)
    .withEnvironment("POSTGRES_USER", postgres.userNameParameter)
    .withEnvironment("POSTGRES_PASSWORD", postgres.passwordParameter)
    .withEnvironment("POSTGRES_DB", "atlas")
    .withEnvironment("REDIS_HOST", redisHost)
    .withEnvironment("REDIS_PORT", redisPort)
    .withEnvironment("S3_HOST", minioHost)
    .withEnvironment("S3_PORT", minioPort)
    .withEnvironment("S3_ACCESS_KEY_ID", "atlasminio")
    .withEnvironment("S3_SECRET_ACCESS_KEY", "atlasminio")
    .withEnvironment("S3_BUCKET", "atlas-documents")
    .withEnvironment("S3_FORCE_PATH_STYLE", "true")
    .withEnvironment("S3_REGION", "us-east-1")
    .withEnvironment("QDRANT_HOST", qdrantHost)
    .withEnvironment("QDRANT_PORT", qdrantPort)
    .withEnvironment("QDRANT_COLLECTION", "atlas_chunks")
    .withEnvironment("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    .withEnvironment(
      "JWT_SECRET",
      "change-me-in-production-use-long-random-string",
    )
    .withEnvironment("OTEL_ENABLED", "true")
    .withEnvironment("OTEL_SERVICE_NAME", otelServiceName);
}

const api = await builder
  .addNodeApp("api", "../apps/api", "src/index.ts")
  .withPnpm()
  .withHttpEndpoint({ env: "API_PORT" })
  .withHttpHealthCheck({ path: "/health/live" });

await wireAtlasService(api, "atlas-api");
await api.withEnvironment("API_HOST", "0.0.0.0");

const worker = await builder
  .addNodeApp("worker", "../apps/worker", "src/index.ts")
  .withPnpm();

await wireAtlasService(worker, "atlas-worker");

await builder.build().run();
