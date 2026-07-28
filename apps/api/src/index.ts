import closeWithGrace from "close-with-grace";
import { loadEnv } from "@atlas/config";
import { startTracing, shutdownTracing } from "@atlas/observability";
import { buildDeps } from "./deps.js";
import { buildApp } from "./app.js";

async function main() {
  const env = loadEnv();
  await startTracing({
    enabled: env.OTEL_ENABLED,
    // Aspire AppHost sets OTEL_SERVICE_NAME to the full resource name (atlas-api).
    serviceName: env.OTEL_SERVICE_NAME.endsWith("-api")
      ? env.OTEL_SERVICE_NAME
      : `${env.OTEL_SERVICE_NAME}-api`,
    environment: env.NODE_ENV,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    ...(env.OTEL_EXPORTER_OTLP_HEADERS
      ? { otlpHeaders: env.OTEL_EXPORTER_OTLP_HEADERS }
      : {}),
  });

  const deps = await buildDeps(env);
  const app = await buildApp(env, deps);

  await app.listen({ host: env.API_HOST, port: env.API_PORT });
  deps.logger.info(
    { host: env.API_HOST, port: env.API_PORT },
    "Atlas API listening",
  );

  closeWithGrace({ delay: 10_000 }, async ({ err, signal }) => {
    if (err) {
      deps.logger.error({ err }, "Server closing due to error");
    } else {
      deps.logger.info({ signal }, "Graceful shutdown");
    }
    await app.close();
    if ("close" in deps.jobQueue && typeof deps.jobQueue.close === "function") {
      await deps.jobQueue.close();
    }
    await deps.prisma.$disconnect();
    await shutdownTracing();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
