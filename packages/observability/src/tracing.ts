import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { Resource } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | undefined;

export interface StartTracingOptions {
  /** Explicit toggle from config (Compose path). */
  enabled?: boolean;
  serviceName: string;
  /** deployment.environment resource attribute (defaults to NODE_ENV). */
  environment?: string;
  /** Base OTLP endpoint, e.g. http://localhost:4318 — Aspire injects this. */
  otlpEndpoint?: string;
  /** Optional headers, e.g. "x-otlp-api-key=..." from OTEL_EXPORTER_OTLP_HEADERS. */
  otlpHeaders?: string;
}

function parseOtlpHeaders(raw?: string): Record<string, string> | undefined {
  if (!raw?.trim()) return undefined;
  const headers: Record<string, string> = {};
  for (const part of raw.split(",")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) headers[key] = value;
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function resolveEndpoint(explicit?: string): string | undefined {
  return (
    explicit?.trim() ||
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"]?.trim() ||
    undefined
  );
}

/**
 * Start OpenTelemetry using standard OTEL_* env vars (Aspire-compatible).
 *
 * Uses OTLP/HTTP + protobuf (`application/x-protobuf`). Aspire Dashboard rejects
 * OTLP/JSON with HTTP 415 Unsupported Media Type.
 *
 * Traces + metrics export via dedicated exporters. Pino logs are bridged via
 * `createLogger()` → OpenTelemetry Logs API → BatchLogRecordProcessor → OTLP
 * `/v1/logs` (Aspire Structured logs). Requires Aspire Dashboard ≥ 9.5.
 *
 * Enables when `enabled` is true OR Aspire injects an OTLP endpoint.
 *
 * Call before `createLogger()`.
 */
export async function startTracing(
  options: StartTracingOptions,
): Promise<void> {
  if (sdk) return;

  const endpoint = resolveEndpoint(options.otlpEndpoint);
  const enabledExplicitly =
    options.enabled === true ||
    process.env["OTEL_ENABLED"] === "true" ||
    process.env["OTEL_ENABLED"] === "1";
  // Aspire injects OTEL_EXPORTER_OTLP_ENDPOINT at runtime; only auto-enable then
  // (not when we merely have a local default in config).
  const aspireInjected = Boolean(
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"]?.trim() &&
      process.env["ASPIRE_DASHBOARD_OTLP_ENDPOINT_URL"],
  );
  const enabled = enabledExplicitly || aspireInjected;

  if (!enabled || !endpoint) return;

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const base = endpoint.replace(/\/$/, "");
  const headers =
    parseOtlpHeaders(options.otlpHeaders) ??
    parseOtlpHeaders(process.env["OTEL_EXPORTER_OTLP_HEADERS"]);

  // Prefer the explicit per-process name (e.g. atlas-api / atlas-worker).
  // Do not let a shared OTEL_SERVICE_NAME=atlas from .env collapse both services.
  const serviceName =
    options.serviceName.trim() ||
    process.env["OTEL_SERVICE_NAME"]?.trim() ||
    "unknown";

  const headerOpt = headers ? { headers } : {};
  const environment =
    options.environment?.trim() ||
    process.env["NODE_ENV"]?.trim() ||
    "development";
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    "service.instance.id":
      process.env["OTEL_SERVICE_INSTANCE_ID"]?.trim() ||
      `${serviceName}-${process.pid}`,
    "deployment.environment": environment,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({
      url: `${base}/v1/traces`,
      ...headerOpt,
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${base}/v1/metrics`,
        ...headerOpt,
      }),
      exportIntervalMillis: 5_000,
    }),
    logRecordProcessors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: `${base}/v1/logs`,
          ...headerOpt,
        }),
        { scheduledDelayMillis: 1_000 },
      ),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
      }),
    ],
  });

  await sdk.start();
  console.info(
    `[otel] exporting traces+metrics+logs (protobuf) to ${base} as ${serviceName}`,
  );
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = undefined;
}
