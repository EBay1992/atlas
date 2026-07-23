import { describe, expect, it } from "vitest";
import { chunkText } from "./chunking.js";
import { normalizeDocumentText } from "./normalize-text.js";

/** Assert each chunk is a contiguous word-bounded substring of the source. */
function assertWordBounded(source: string, chunks: ReturnType<typeof chunkText>) {
  const normalized = normalizeDocumentText(source);
  for (const chunk of chunks) {
    const start = normalized.indexOf(chunk.text);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = start + chunk.text.length;

    if (start > 0) {
      expect(normalized[start - 1]).toMatch(/\s/);
    }
    if (end < normalized.length) {
      expect(normalized[end]).toMatch(/\s/);
    }
    expect(chunk.text).toBe(chunk.text.trim());
  }
}

describe("chunkText", () => {
  it("returns empty for blank input", () => {
    expect(chunkText("   ", { size: 100, overlap: 20 })).toEqual([]);
  });

  it("returns a single chunk when text fits", () => {
    const chunks = chunkText("hello atlas", { size: 100, overlap: 20 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.ordinal).toBe(0);
    expect(chunks[0]?.text).toBe("hello atlas");
  });

  it("produces overlapping windows without splitting words", () => {
    const text = "alpha bravo charlie delta echo foxtrot golf hotel";
    const chunks = chunkText(text, { size: 20, overlap: 5 });
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]?.ordinal).toBe(i);
    }
    assertWordBounded(text, chunks);
  });

  it("clamps overlap below size", () => {
    const text = "one two three four five six seven";
    const chunks = chunkText(text, { size: 10, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    assertWordBounded(text, chunks);
  });

  it("never starts or ends mid-word on prose", () => {
    const text =
      "The quick brown fox jumps over the lazy dog near the riverbank.";
    const chunks = chunkText(text, { size: 25, overlap: 8 });
    expect(chunks.length).toBeGreaterThan(1);
    assertWordBounded(text, chunks);
  });

  it("keeps an oversize token intact instead of splitting letters", () => {
    const token = "x".repeat(50);
    const text = `before ${token} after`;
    const chunks = chunkText(text, { size: 20, overlap: 4 });
    expect(chunks.some((c) => c.text === token)).toBe(true);
    assertWordBounded(text, chunks);
  });

  it("treats newlines as word boundaries", () => {
    const text = "first line\nsecond line\nthird line of text here";
    const chunks = chunkText(text, { size: 18, overlap: 4 });
    assertWordBounded(text, chunks);
  });
});
