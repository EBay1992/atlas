import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

export function createMetricsRegistry(
  serviceName: string,
  options?: { environment?: string },
): {
  registry: Registry;
  httpRequestDuration: Histogram<string>;
  uploadBytes: Counter<string>;
  jobsEnqueued: Counter<string>;
  jobsCompleted: Counter<string>;
  jobsFailed: Counter<string>;
  workerProcessingDuration: Histogram<string>;
  queueDepth: Gauge<string>;
} {
  const registry = new Registry();
  registry.setDefaultLabels({
    service: serviceName,
    ...(options?.environment
      ? { environment: options.environment }
      : {}),
  });
  collectDefaultMetrics({ register: registry });

  const httpRequestDuration = new Histogram({
    name: "atlas_http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const uploadBytes = new Counter({
    name: "atlas_upload_bytes_total",
    help: "Total bytes uploaded",
    labelNames: ["tenant_id"],
    registers: [registry],
  });

  const jobsEnqueued = new Counter({
    name: "atlas_jobs_enqueued_total",
    help: "Jobs enqueued",
    labelNames: ["tenant_id"],
    registers: [registry],
  });

  const jobsCompleted = new Counter({
    name: "atlas_jobs_completed_total",
    help: "Jobs completed",
    labelNames: ["tenant_id"],
    registers: [registry],
  });

  const jobsFailed = new Counter({
    name: "atlas_jobs_failed_total",
    help: "Jobs failed",
    labelNames: ["tenant_id"],
    registers: [registry],
  });

  const workerProcessingDuration = new Histogram({
    name: "atlas_worker_processing_duration_seconds",
    help: "Worker job processing duration",
    labelNames: ["outcome"],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    registers: [registry],
  });

  const queueDepth = new Gauge({
    name: "atlas_queue_depth",
    help: "Approximate queue depth",
    labelNames: ["queue"],
    registers: [registry],
  });

  return {
    registry,
    httpRequestDuration,
    uploadBytes,
    jobsEnqueued,
    jobsCompleted,
    jobsFailed,
    workerProcessingDuration,
    queueDepth,
  };
}

export type AtlasMetrics = ReturnType<typeof createMetricsRegistry>;
