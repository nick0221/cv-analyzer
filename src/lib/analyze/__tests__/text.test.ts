import { describe, it, expect } from "vitest";
import { extractBullets, hasMetric, stem, estimatePages, wordCount } from "../text";
import { normalizeExtracted } from "../../parse/pdf";

describe("extractBullets", () => {
  it("picks up several bullet glyph styles", () => {
    const bullets = extractBullets("- One\n• Two\n* Three\n▪ Four\n1. Five");
    expect(bullets).toEqual(["One", "Two", "Three", "Four", "Five"]);
  });

  it("ignores non-bullet prose lines", () => {
    expect(extractBullets("Just a sentence\nAnd another")).toHaveLength(0);
  });
});

describe("hasMetric", () => {
  it("detects numbers, percentages and money", () => {
    expect(hasMetric("Increased revenue 23%")).toBe(true);
    expect(hasMetric("Managed a $120K budget")).toBe(true);
    expect(hasMetric("Led a team")).toBe(false);
  });
});

describe("stem", () => {
  it("collapses common verb/gerund forms", () => {
    expect(stem("managing")).toBe(stem("managed"));
    expect(stem("designing")).toBe(stem("designed"));
  });
});

describe("estimatePages", () => {
  it("estimates roughly one page near 500 words", () => {
    const text = Array.from({ length: 500 }, () => "word").join(" ");
    expect(estimatePages(text)).toBe(1);
  });

  it("counts words ignoring extra whitespace", () => {
    expect(wordCount("  a  b   c ")).toBe(3);
  });
});

describe("normalizeExtracted", () => {
  it("normalizes smart quotes, dashes and collapsed blank lines", () => {
    const out = normalizeExtracted("“Hello” – world\u00a0test\n\n\n\nnext");
    expect(out).toContain('"Hello" - world test');
    expect(out).not.toMatch(/\n{3,}/);
  });
});
