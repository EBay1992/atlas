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

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(""),

  S3_ENDPOINT: z.string().url(),
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
  QDRANT_URL: z.string().url().default("http://localhost:6333"),
  QDRANT_COLLECTION: z.string().default("atlas_chunks"),
  CHUNK_SIZE: z.coerce.number().int().positive().default(800),
  CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(120),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(16),

  OTEL_ENABLED: boolFromString.default(false),
  OTEL_SERVICE_NAME: z.string().default("atlas"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default("http://localhost:4318"),
});

export type Env = z.infer<typeof envSchema>;

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

  const env = parsed.data;
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
