import type { Span } from "@opentelemetry/api";
import { withLinkedRootSpan, withSpan } from "./context.js";

export type ObserveAttributes = Record<string, string | number | boolean>;

/**
 * Trace an async operation. Prefer this at call sites over raw span lifecycle.
 *
 * @example
 * await observe("embed.batch", async () => embeddings.embed(batch), attrs);
 */
export async function observe<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: ObserveAttributes,
): Promise<T> {
  return withSpan(name, fn, attributes);
}

/**
 * Trace a new root span linked to a prior W3C carrier (manual / DLQ retry).
 */
export async function observeLinked<T>(
  name: string,
  linkCarrier: Record<string, string | undefined>,
  fn: (span: Span) => Promise<T>,
  attributes?: ObserveAttributes,
): Promise<T> {
  return withLinkedRootSpan(name, linkCarrier, fn, attributes);
}

type AttrFactory<TArgs extends unknown[]> =
  | ObserveAttributes
  | ((...args: TArgs) => ObserveAttributes | undefined);

/**
 * Functional decorator: wrap a handler so every invocation is one named span.
 *
 * @example
 * const handleUpload = traced(
 *   "documents.upload",
 *   (req) => atlasSpanAttrs({ tenantId: req.auth!.tenantId }),
 * )(async (req, reply) => { ... });
 */
export function traced<TArgs extends unknown[], TResult>(
  name: string,
  attributes?: AttrFactory<TArgs>,
): (
  fn: (...args: TArgs) => Promise<TResult>,
) => (...args: TArgs) => Promise<TResult> {
  return (fn) =>
    async (...args: TArgs): Promise<TResult> => {
      const attrs =
        typeof attributes === "function" ? attributes(...args) : attributes;
      return observe(name, async () => fn(...args), attrs);
    };
}
