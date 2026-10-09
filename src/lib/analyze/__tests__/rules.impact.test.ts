import { describe, it, expect } from "vitest";
import { runImpactRule } from "../rules/impact";

describe("runImpactRule", () => {
  it("returns a flat 25 and no metric scoring when there are no bullets", () => {
    const r = runImpactRule("Jane Doe\nSummary\nJust a person.");
    expect(r.key).toBe("impact");
    expect(r.score).toBe(25);
    expect(r.summary).toBe("No bullets to evaluate for measurable results.");
    expect(r.recommendations.find((x) => /convert prose into bullet/i.test(x.title))?.priority).toBe("high");
  });

  it("scores fully quantified bullets at 100", () => {
    const text = `Experience
- Reduced deploy time 40% across 3 services.
- Grew revenue by $250K in 6 months.
- Cut API latency 60% for 12 endpoints.`;
    const r = runImpactRule(text);
    expect(r.score).toBe(100);
    expect(r.findings.join(" ")).toMatch(/\(100%\) contain a number or metric/);
  });

  it("flags bullets with no metrics at the high priority", () => {
    const text = `Experience
- Responsible for various tasks.
- Helped with the team.
- Worked on stuff.`;
    const r = runImpactRule(text);
    expect(r.score).toBe(20);
    expect(r.summary).toBe("0% of bullets are quantified.");
    expect(r.recommendations.find((x) => /quantify your bullets/i.test(x.title))?.priority).toBe("high");
    expect(r.recommendations.some((x) => /most recent role/i.test(x.title))).toBe(true);
  });

  it("downgrades to medium between 30% and 60% quantified", () => {
    const text = `Experience
- Reduced latency 40%.
- Wrote documentation for the team.
- Attended standups with the team.`;
    const r = runImpactRule(text);
    // 1 of 3 = 33.3% -> medium band.
    expect(r.score).toBe(47);
    expect(r.recommendations.find((x) => /measurable outcomes/i.test(x.title))?.priority).toBe("medium");
    expect(r.recommendations.some((x) => /quantify your bullets/i.test(x.title))).toBe(false);
  });
});
