import type {
  TextExtractInput,
  TextExtractResult,
  TextExtractor,
} from "@atlas/domain";
import { normalizeDocumentText } from "@atlas/domain";
import { PDFParse } from "pdf-parse";

export class UnsupportedContentTypeError extends Error {
  constructor(contentType: string) {
    super(`Unsupported content type for extraction: ${contentType}`);
    this.name = "UnsupportedContentTypeError";
  }
}

function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export class MimeTextExtractor implements TextExtractor {
  async extract(input: TextExtractInput): Promise<TextExtractResult> {
    const contentType = normalizeContentType(input.contentType);
    const filename = (input.filename ?? "").toLowerCase();

    if (
      contentType.startsWith("text/") ||
      contentType === "application/json" ||
      contentType === "application/xml" ||
      filename.endsWith(".md") ||
      filename.endsWith(".txt") ||
      filename.endsWith(".csv")
    ) {
      return { text: normalizeDocumentText(input.body.toString("utf8")) };
    }

    if (contentType === "application/pdf" || filename.endsWith(".pdf")) {
      const parser = new PDFParse({ data: input.body });
      try {
        const result = await parser.getText({
          // Disable default page markers like "-- 2 of 2 --"
          pageJoiner: "\n",
        });
        return {
          text: normalizeDocumentText(result.text ?? ""),
          pageCount: result.total,
        };
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    }

    throw new UnsupportedContentTypeError(contentType || "unknown");
  }
}
