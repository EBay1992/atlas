import {
  ROOT_CONTEXT,
  context,
  propagation,
  SpanStatusCode,
  trace,
  type Span,
  type Context,
  type SpanContext,
} from "@opentelemetry/api";

const TRACER_NAME = "atlas";

export function getTracer(name = TRACER_NAME) {
  return trace.getTracer(name);
}

export function getActiveTraceIds(): {
  traceId?: string;
  spanId?: string;
} {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  if (!ctx.traceId || ctx.traceId === "00000000000000000000000000000000") {
    return {};
  }
  return { traceId: ctx.traceId, spanId: ctx.spanId };
}

/** Inject W3C Trace Context into a carrier (e.g. BullMQ job payload fields). */
export function injectTraceContext(
  carrier: Record<string, string> = {},
): Record<string, string> {
  propagation.inject(context.active(), carrier);
  return carrier;
}

function cleanCarrier(
  carrier: Record<string, string | undefined>,
): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(carrier)) {
    if (typeof v === "string" && v.length > 0) clean[k] = v;
  }
  return clean;
}

/** Extract W3C Trace Context from a carrier into an OpenTelemetry Context. */
export function extractTraceContext(
  carrier: Record<string, string | undefined>,
): Context {
  return propagation.extract(context.active(), cleanCarrier(carrier));
}

export type AtlasAttrInput = {
  documentId?: string;
  jobId?: string;
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  attempt?: number;
  storageKey?: string;
};

/** Normalize camelCase Atlas identifiers to `atlas.*` span attribute keys. */
export function atlasSpanAttrs(
  input: AtlasAttrInput,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (input.documentId) out["atlas.document_id"] = input.documentId;
  if (input.jobId) out["atlas.job_id"] = input.jobId;
  if (input.tenantId) out["atlas.tenant_id"] = input.tenantId;
  if (input.userId) out["atlas.user_id"] = input.userId;
  if (input.correlationId) out["atlas.correlation_id"] = input.correlationId;
  if (input.attempt !== undefined) out["atlas.attempt"] = input.attempt;
  if (input.storageKey) out["atlas.storage_key"] = input.storageKey;
  return out;
}

function remoteSpanContext(
  carrier: Record<string, string | undefined>,
): SpanContext | undefined {
  const extracted = propagation.extract(ROOT_CONTEXT, cleanCarrier(carrier));
  const span = trace.getSpan(extracted);
  const sc = span?.spanContext();
  if (!sc?.traceId || sc.traceId === "00000000000000000000000000000000") {
    return undefined;
  }
  return sc;
}

async function runSpan<T>(
  span: Span,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  try {
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
    }
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof Error) {
      span.recordException(err);
    }
    throw err;
  } finally {
    span.end();
  }
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, (span) =>
    runSpan(span, fn, attributes),
  );
}

/**
 * Start a new root span (new Trace ID) linked to a prior W3C carrier.
 * Used for manual/DLQ retries — a new business action related to an older upload.
 */
export async function withLinkedRootSpan<T>(
  name: string,
  linkCarrier: Record<string, string | undefined>,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const tracer = getTracer();
  const linked = remoteSpanContext(linkCarrier);
  const links = linked ? [{ context: linked }] : [];

  return tracer.startActiveSpan(name, { root: true, links }, (span) =>
    runSpan(span, fn, attributes),
  );
}

export async function withExtractedContext<T>(
  carrier: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const ctx = extractTraceContext(carrier);
  return context.with(ctx, fn);
}
