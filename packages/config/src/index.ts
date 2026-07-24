import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

function loadDotenvFiles(): void {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), "../../../.env"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      loadDotenv({ path, override: false });
    }
  }
}

loadDotenvFiles();

const boolFromString = z
  .union([z.boolean(), z.string()])
  .transform((v) => {
    if (typeof v === "boolean") return v;
    return v === "true" || v === "1";
  });

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("1h"),

  DATABASE_URL: z.string().optional(),
  // Alternative parts (Aspire / K8s can inject these instead of a full URL).
  POSTGRES_HOST: z.string().optional(),
  POSTGRES_PORT: z.coerce.number().int().positive().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DB: z.string().optional(),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(""),

  S3_ENDPOINT: z.string().optional(),
  S3_HOST: z.string().optional(),
  S3_PORT: z.coerce.number().int().positive().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: boolFromString.default(true),

  INGESTION_QUEUE_NAME: z.string().default("ingestion"),
  INGESTION_DLQ_NAME: z.string().default("ingestion-dlq"),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),

  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_EMBEDDING_MODEL: z.string().default("qwen3-embedding:latest"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(4096),
  QDRANT_URL: z.string().optional(),
  QDRANT_HOST: z.string().optional(),
  QDRANT_PORT: z.coerce.number().int().positive().optional(),
  QDRANT_COLLECTION: z.string().default("atlas_chunks"),
  CHUNK_SIZE: z.coerce.number().int().positive().default(800),
  CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(120),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(16),

  OTEL_ENABLED: boolFromString.default(false),
  OTEL_SERVICE_NAME: z.string().default("atlas"),
  // Empty string allowed — Aspire injects a real endpoint at runtime.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://localhost:4318"),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema> & {
  DATABASE_URL: string;
  S3_ENDPOINT: string;
  QDRANT_URL: string;
};

function resolveConnectionUrls(
  raw: z.infer<typeof envSchema>,
): Pick<Env, "DATABASE_URL" | "S3_ENDPOINT" | "QDRANT_URL"> {
  const databaseUrl =
    raw.DATABASE_URL ||
    (raw.POSTGRES_HOST &&
    raw.POSTGRES_PORT &&
    raw.POSTGRES_USER &&
    raw.POSTGRES_PASSWORD &&
    raw.POSTGRES_DB
      ? `postgresql://${encodeURIComponent(raw.POSTGRES_USER)}:${encodeURIComponent(raw.POSTGRES_PASSWORD)}@${raw.POSTGRES_HOST}:${raw.POSTGRES_PORT}/${raw.POSTGRES_DB}?schema=public`
      : undefined);

  if (!databaseUrl) {
    throw new Error(
      "Invalid environment configuration:\n  DATABASE_URL: Required (or POSTGRES_HOST/PORT/USER/PASSWORD/DB)",
    );
  }

  const s3Endpoint =
    raw.S3_ENDPOINT ||
    (raw.S3_HOST && raw.S3_PORT
      ? `http://${raw.S3_HOST}:${raw.S3_PORT}`
      : undefined);
  if (!s3Endpoint) {
    throw new Error(
      "Invalid environment configuration:\n  S3_ENDPOINT: Required (or S3_HOST + S3_PORT)",
    );
  }

  const qdrantUrl =
    raw.QDRANT_URL ||
    (raw.QDRANT_HOST && raw.QDRANT_PORT
      ? `http://${raw.QDRANT_HOST}:${raw.QDRANT_PORT}`
      : undefined);
  if (!qdrantUrl) {
    throw new Error(
      "Invalid environment configuration:\n  QDRANT_URL: Required (or QDRANT_HOST + QDRANT_PORT)",
    );
  }

  return { DATABASE_URL: databaseUrl, S3_ENDPOINT: s3Endpoint, QDRANT_URL: qdrantUrl };
}

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const urls = resolveConnectionUrls(parsed.data);
  const env: Env = { ...parsed.data, ...urls };
  if (
    env.NODE_ENV === "production" &&
    (env.JWT_SECRET.includes("change-me") || env.JWT_SECRET.length < 32)
  ) {
    throw new Error(
      "Refusing to start: set a strong JWT_SECRET (at least 32 random characters) in production",
    );
  }

  cached = env;
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}
