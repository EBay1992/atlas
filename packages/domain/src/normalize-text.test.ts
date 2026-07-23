import { describe, expect, it } from "vitest";
import { normalizeDocumentText } from "./normalize-text.js";

describe("normalizeDocumentText", () => {
  it("removes pdf-parse page markers", () => {
    const input = "Skills: Py\n\n-- 2 of 2 --\n\nthon), Web Development";
    expect(normalizeDocumentText(input)).toBe(
      "Skills: Python), Web Development",
    );
  });

  it("joins hyphenated line breaks", () => {
    expect(normalizeDocumentText("knowl-\nedge graph")).toBe("knowledge graph");
  });

  it("joins mid-word newlines before lowercase continuations", () => {
    expect(normalizeDocumentText("Py\nthon and Node\njs")).toBe("Python and Nodejs");
  });

  it("does not join a newline before a capital letter", () => {
    expect(normalizeDocumentText("Java\nScript")).toBe("Java\nScript");
  });

  it("preserves normal paragraph breaks before capitals", () => {
    expect(normalizeDocumentText("First sentence.\nNext sentence.")).toBe(
      "First sentence.\nNext sentence.",
    );
  });

  it("strips soft hyphens", () => {
    expect(normalizeDocumentText("net\u00adwork")).toBe("network");
  });
});
