import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | undefined;

export async function startTracing(options: {
  enabled: boolean;
  serviceName: string;
  otlpEndpoint: string;
}): Promise<void> {
  if (!options.enabled) return;
  if (sdk) return;

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: options.serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${options.otlpEndpoint.replace(/\/$/, "")}/v1/traces`,
    }),
  });

  await sdk.start();
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = undefined;
}
