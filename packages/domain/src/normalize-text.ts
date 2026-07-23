/**
 * Normalize extracted document text before chunking.
 * Especially important for PDFs that insert page markers and break words across lines.
 */
export function normalizeDocumentText(text: string): string {
  let out = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Soft hyphen (U+00AD) used by some PDFs for line wrapping
  out = out.replace(/\u00ad/g, "");

  // pdf-parse style page markers: "-- 2 of 2 --" / "-- page_number of total_number --"
  out = out.replace(/\n?\s*--\s*\d+\s+of\s+\d+\s*--\s*\n?/g, "\n");

  // Hyphenated line breaks: "knowl-\nedge" → "knowledge"
  out = out.replace(/(\p{L})-\n(\p{L})/gu, "$1$2");

  // Mid-word line/page breaks without hyphen: "Py\nthon" → "Python"
  // Only join when the next line starts with a lowercase letter (continuation).
  out = out.replace(/(\p{L})\n(\p{Ll})/gu, "$1$2");

  // Collapse runs of blank lines
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}
