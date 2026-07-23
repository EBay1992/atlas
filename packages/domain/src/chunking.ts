import { normalizeDocumentText } from "./normalize-text.js";

export interface ChunkTextOptions {
  size: number;
  overlap: number;
}

export interface TextChunk {
  ordinal: number;
  text: string;
  tokenEstimate: number;
}

function isWhitespace(char: string | undefined): boolean {
  return char !== undefined && /\s/.test(char);
}

/** True when `index` is at the first character of a word (or at EOF). */
function isWordStart(text: string, index: number): boolean {
  if (index <= 0) return true;
  if (index >= text.length) return true;
  return isWhitespace(text[index - 1]) && !isWhitespace(text[index]);
}

/** Move forward to the next word start (skips whitespace). */
function snapToWordStart(text: string, index: number): number {
  let i = Math.max(0, index);
  while (i < text.length && isWhitespace(text[i])) i += 1;
  while (i > 0 && i < text.length && !isWordStart(text, i)) i += 1;
  return i;
}

/**
 * Choose an exclusive end index that does not split a word.
 * Prefers the last whitespace before `start + size`. If a single token is
 * longer than `size`, the whole token is kept (chunk may exceed size).
 */
function findWordSafeEnd(text: string, start: number, size: number): number {
  if (start >= text.length) return text.length;

  const hardLimit = Math.min(start + size, text.length);
  if (hardLimit >= text.length) return text.length;

  if (isWhitespace(text[hardLimit])) {
    let end = hardLimit;
    while (end > start && isWhitespace(text[end - 1])) end -= 1;
    return end > start ? end : hardLimit;
  }

  // Walk back to the last non-whitespace run that fits in the window
  let end = hardLimit;
  while (end > start && !isWhitespace(text[end - 1])) end -= 1;
  while (end > start && isWhitespace(text[end - 1])) end -= 1;
  if (end > start) return end;

  // No whitespace in window: keep the entire oversize token
  end = hardLimit;
  while (end < text.length && !isWhitespace(text[end])) end += 1;
  return end;
}

/**
 * Overlapping character windows that always start and end on word boundaries.
 * `tokenEstimate` is a rough heuristic (~4 chars/token) for metrics — not a tokenizer.
 */
export function chunkText(
  text: string,
  options: ChunkTextOptions,
): TextChunk[] {
  const size = Math.max(1, Math.floor(options.size));
  const overlap = Math.max(0, Math.min(Math.floor(options.overlap), size - 1));
  const normalized = normalizeDocumentText(text);
  if (!normalized) return [];

  const chunks: TextChunk[] = [];
  let offset = 0;
  let ordinal = 0;

  while (offset < normalized.length) {
    const start = snapToWordStart(normalized, offset);
    if (start >= normalized.length) break;

    const end = findWordSafeEnd(normalized, start, size);
    const trimmed = normalized.slice(start, end).trim();

    if (trimmed.length > 0) {
      chunks.push({
        ordinal,
        text: trimmed,
        tokenEstimate: Math.max(1, Math.ceil(trimmed.length / 4)),
      });
      ordinal += 1;
    }

    if (end >= normalized.length) break;

    // Retreat by overlap, then snap so the next chunk never starts mid-word
    let next = snapToWordStart(normalized, Math.max(end - overlap, start + 1));
    if (next <= start) {
      next = snapToWordStart(normalized, end);
    }
    offset = next;
  }

  return chunks;
}
