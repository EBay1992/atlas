import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { context, propagation, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  injectTraceContext,
  withExtractedContext,
  withLinkedRootSpan,
  withSpan,
} from "./context.js";

describe("trace continuation vs linked root", () => {
  const exporter = new InMemorySpanExporter();
  let provider: BasicTracerProvider;

  beforeAll(() => {
    const manager = new AsyncLocalStorageContextManager();
    manager.enable();
    context.setGlobalContextManager(manager);
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    trace.setGlobalTracerProvider(provider);
  });

  beforeEach(() => {
    exporter.reset();
  });

  afterAll(async () => {
    await provider.forceFlush();
    await provider.shutdown();
  });

  it("withExtractedContext continues the same traceId", async () => {
    let parentTraceId = "";
    let childTraceId = "";

    await withSpan("upload", async (span) => {
      parentTraceId = span.spanContext().traceId;
      const carrier = injectTraceContext({});

      await withExtractedContext(carrier, async () => {
        await withSpan("ingestion.process", async (child) => {
          childTraceId = child.spanContext().traceId;
        });
      });
    });

    expect(parentTraceId).toBeTruthy();
    expect(childTraceId).toBe(parentTraceId);

    const spans = exporter.getFinishedSpans();
    const child = spans.find((s) => s.name === "ingestion.process");
    expect(child?.parentSpanId).toBe(
      spans.find((s) => s.name === "upload")?.spanContext().spanId,
    );
  });

  it("withLinkedRootSpan creates a new traceId linked to the original", async () => {
    let originalTraceId = "";
    let carrier: Record<string, string> = {};

    await withSpan("upload", async (span) => {
      originalTraceId = span.spanContext().traceId;
      carrier = injectTraceContext({});
    });

    let retryTraceId = "";
    await withLinkedRootSpan(
      "ingestion.process",
      carrier,
      async (retrySpan) => {
        retryTraceId = retrySpan.spanContext().traceId;
      },
    );

    expect(originalTraceId).toBeTruthy();
    expect(retryTraceId).toBeTruthy();
    expect(retryTraceId).not.toBe(originalTraceId);

    const spans = exporter.getFinishedSpans();
    expect(spans.map((s) => s.name)).toEqual(
      expect.arrayContaining(["upload", "ingestion.process"]),
    );

    const retry = spans.find((s) => s.name === "ingestion.process")!;
    expect(retry.links.length).toBeGreaterThanOrEqual(1);
    expect(retry.links[0]!.context.traceId).toBe(originalTraceId);
    const uploadId = spans.find((s) => s.name === "upload")!.spanContext().spanId;
    expect(retry.parentSpanId).not.toBe(uploadId);
  });
});
