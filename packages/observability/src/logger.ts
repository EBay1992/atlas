import pino, { type Logger } from "pino";

export type LogLevel =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | "silent";

export function createLogger(options: {
  service: string;
  level?: LogLevel;
  pretty?: boolean;
}): Logger {
  return pino({
    level: options.level ?? "info",
    base: { service: options.service },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });
}

export type { Logger };
