import { describe, it, expect } from "vitest";
import { runAtsRule } from "../rules/ats";

describe("runAtsRule", () => {
  const CLEAN = `Jane Doe
jane@example.com | +1 555 123 4567

Experience
Senior Engineer, Acme - Mar 2021 - Present
Built services that served 10K users.`;

  it("scores clean, dated text at 100", () => {
    const r = runAtsRule(CLEAN);
    expect(r.key).toBe("ats");
    expect(r.score).toBe(100);
    expect(r.summary).toBe("ATS-friendly formatting.");
    expect(r.findings).toContain("Employment date ranges are present and parseable.");
    expect(r.recommendations).toEqual([]);
  });

  it("penalizes text with no 4-digit years at all", () => {
    const r = runAtsRule("Jane Doe\nExperience\nBuilt services for users.");
    expect(r.score).toBe(85);
    expect(r.findings).toContain("No 4-digit years found.");
    const rec = r.recommendations.find((x) => /explicit dates/i.test(x.title));
    expect(rec?.priority).toBe("high");
  });

  it("docks less when years exist but no start-end range", () => {
    const r = runAtsRule("Jane Doe\nWorked at Acme in 2019 and 2020 and 2022.");
    expect(r.score).toBe(92);
    expect(r.findings).toContain("Years are present but no clear employment ranges.");
    expect(r.recommendations.find((x) => /consistent date ranges/i.test(x.title))?.priority).toBe("medium");
  });

  it("flags a multi-column layout from a high ratio of very short lines", () => {
    // 20 non-empty lines, all far under 28 chars, but with a valid date range
    // so the date penalty cannot fire — isolating the layout penalty (-15).
    const lines = Array.from({ length: 19 }, (_, i) => `Skill ${i} here`);
    lines.push("2019 - 2021");
    const r = runAtsRule(lines.join("\n"));
    expect(r.score).toBe(85);
    expect(r.findings.some((f) => /multi-column layout/.test(f))).toBe(true);
    expect(r.recommendations.find((x) => /single-column/i.test(x.title))?.priority).toBe("medium");
  });

  it("does not flag multi-column on a short document", () => {
    // Same short-line shape but only 5 lines: the nonEmpty > 15 guard applies.
    const r = runAtsRule("Role A\nRole B\nRole C\nRole D\n2019 - 2021");
    expect(r.findings.some((f) => /multi-column layout/.test(f))).toBe(false);
  });

  it("notes header/footer artifacts without changing the score", () => {
    const r = runAtsRule(`${CLEAN}\nPage 1 of 2`);
    expect(r.score).toBe(100);
    expect(r.findings).toContain("Header/footer artifacts detected in extracted text.");
    expect(r.recommendations.find((x) => /headers and footers/i.test(x.title))?.priority).toBe("low");
  });

  it("penalizes heavy emoji/glyph use", () => {
    const glyphs = "⭐⭐⭐⭐ ⚡🚀🎯 ";
    const r = runAtsRule(`${CLEAN}\n${glyphs}`);
    expect(r.score).toBe(95);
    expect(r.findings.some((f) => /special symbols\/emoji/.test(f))).toBe(true);
  });

  it("stays within 0-100", () => {
    const r = runAtsRule("x");
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
