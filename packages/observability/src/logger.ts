import { SeverityNumber, logs } from "@opentelemetry/api-logs";
import pino, { type DestinationStream, type Logger } from "pino";
import { getActiveTraceIds } from "./context.js";

export type LogLevel =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | "silent";

const LEVEL_TO_SEVERITY: Record<string, SeverityNumber> = {
  fatal: SeverityNumber.FATAL,
  error: SeverityNumber.ERROR,
  warn: SeverityNumber.WARN,
  info: SeverityNumber.INFO,
  debug: SeverityNumber.DEBUG,
  trace: SeverityNumber.TRACE,
};

/**
 * Pino → OpenTelemetry Logs bridge.
 *
 * Auto-instrumentation for Pino does not reliably hook under ESM/tsx, so we
 * explicitly emit log records into the SDK LoggerProvider (no-op when OTEL
 * is not started). Aspire Structured logs consumes these via OTLP.
 */
function createOtelLogStream(): DestinationStream {
  return {
    write(msg: string) {
      try {
        const record = JSON.parse(msg) as Record<string, unknown>;
        const levelRaw = record["level"];
        const level = typeof levelRaw === "string" ? levelRaw : "info";
        const msgRaw = record["msg"];
        const body =
          typeof msgRaw === "string"
            ? msgRaw
            : typeof msgRaw === "number"
              ? String(msgRaw)
              : JSON.stringify(msgRaw ?? record);

        const attributes: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(record)) {
          if (
            key === "msg" ||
            key === "level" ||
            key === "time" ||
            key === "v" ||
            key === "hostname" ||
            key === "pid"
          ) {
            continue;
          }
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            attributes[key] = value;
          } else if (value != null) {
            attributes[key] = JSON.stringify(value);
          }
        }

        const timeRaw = record["time"];
        logs.getLogger("atlas-pino").emit({
          severityNumber: LEVEL_TO_SEVERITY[level] ?? SeverityNumber.INFO,
          severityText: level.toUpperCase(),
          body,
          attributes,
          ...(typeof timeRaw === "string" || typeof timeRaw === "number"
            ? { timestamp: new Date(timeRaw) }
            : {}),
        });
      } catch {
        // Never break app logging if OTEL emit fails.
      }
    },
  };
}

export function createLogger(options: {
  service: string;
  level?: LogLevel;
  environment?: string;
}): Logger {
  return pino(
    {
      level: options.level ?? "info",
      base: {
        service: options.service,
        ...(options.environment ? { environment: options.environment } : {}),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      mixin() {
        return getActiveTraceIds();
      },
      formatters: {
        level(label) {
          return { level: label };
        },
      },
    },
    pino.multistream([
      { stream: process.stdout },
      { stream: createOtelLogStream() },
    ]),
  );
}

export type { Logger };
