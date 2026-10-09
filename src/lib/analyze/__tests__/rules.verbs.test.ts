import { describe, it, expect } from "vitest";
import { runVerbsRule } from "../rules/verbs";

describe("runVerbsRule", () => {
  it("returns a flat 40 with no recommendations when there are no bullets", () => {
    const r = runVerbsRule("Jane Doe\nSummary\nJust a person.");
    expect(r.key).toBe("verbs");
    expect(r.score).toBe(40);
    expect(r.summary).toBe("No bullets to evaluate for action verbs.");
    expect(r.recommendations).toEqual([]);
  });

  it("scores all-strong bullets at 100", () => {
    const text = `Experience
- Led a team of 6 engineers.
- Launched a payments feature.
- Reduced API latency by 60%.`;
    const r = runVerbsRule(text);
    expect(r.score).toBe(100);
    expect(r.summary).toBe("100% of bullets lead with a strong verb.");
    expect(r.recommendations).toEqual([]);
  });

  it("heavily penalizes bullets with passive openers", () => {
    const text = `Experience
- Responsible for various tasks.
- Helped with the team.
- Worked on stuff.`;
    const r = runVerbsRule(text);
    expect(r.score).toBe(10);
    expect(r.findings.join(" ")).toMatch(/3 bullet\(s\) open with passive phrasing/);
    expect(r.recommendations.find((x) => /passive openers/i.test(x.title))?.priority).toBe("high");
  });

  it("uses medium priority for a single passive opener", () => {
    const text = `Experience
- Responsible for various tasks.
- Led a team of 6 engineers.`;
    const r = runVerbsRule(text);
    expect(r.recommendations.find((x) => /passive openers/i.test(x.title))?.priority).toBe("medium");
  });

  it("flags filler phrases anywhere in the text", () => {
    const text = `Experience
- Led a team of 6 engineers.
- Managed various tasks and more.`;
    const r = runVerbsRule(text);
    const rec = r.recommendations.find((x) => /filler phrases/i.test(x.title));
    expect(rec?.priority).toBe("low");
    expect(rec?.why).toMatch(/various tasks/);
  });

  it("penalizes a low strong-verb ratio even without passive openers", () => {
    const text = `Experience
- Attended daily planning sessions with the team.
- Participated in design reviews for the platform.
- Led a team of 6 engineers.`;
    const r = runVerbsRule(text);
    // 1 of 3 strong = 33% -> bonus 30, score ~53.
    expect(r.score).toBeLessThan(60);
    expect(r.recommendations.find((x) => /more bullets with strong action verbs/i.test(x.title))?.priority).toBe("medium");
  });
});
