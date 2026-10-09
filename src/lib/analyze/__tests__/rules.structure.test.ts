import { describe, it, expect } from "vitest";
import { runStructureRule } from "../rules/structure";

describe("runStructureRule", () => {
  const COMPLETE = `Jane Doe
jane@example.com | +1 555 123 4567

Summary
Senior engineer.

Experience
Senior Engineer, Acme - Mar 2021 - Present
- Led a team.

Education
B.Sc. Computer Science, State University, 2018

Skills
React, TypeScript, Node.js`;

  it("scores a resume with all five sections at 100", () => {
    const r = runStructureRule(COMPLETE);
    expect(r.key).toBe("structure");
    expect(r.score).toBe(100);
    expect(r.summary).toBe("5/5 standard sections detected.");
    expect(r.recommendations).toEqual([]);
  });

  it("scales the score to the fraction of sections found", () => {
    // Only "Summary / Objective" matches -> 1/5 = 20.
    const r = runStructureRule("Jane Doe\nSummary\nJust a person.");
    expect(r.score).toBe(20);
    expect(r.summary).toBe("1/5 standard sections detected.");
  });

  it("marks missing sections high priority when more than two are absent", () => {
    const r = runStructureRule("Jane Doe\nSummary\nJust a person.");
    const rec = r.recommendations.find((x) => /missing section/i.test(x.title));
    expect(rec?.priority).toBe("high");
    expect(rec?.title).toContain("Contact details");
  });

  it("marks missing sections medium priority when only one or two are absent", () => {
    // Everything but Skills.
    const noSkills = COMPLETE.replace(/\nSkills\nReact, TypeScript, Node\.js$/, "");
    const r = runStructureRule(noSkills);
    const rec = r.recommendations.find((x) => /missing section/i.test(x.title));
    expect(rec?.priority).toBe("medium");
    expect(rec?.title).toBe("Add the missing section: Skills");
  });

  it("asks for an email and a phone when both are absent", () => {
    const r = runStructureRule("Jane Doe\nSummary\nExperience\nEducation\nSkills");
    expect(r.recommendations.find((x) => /reachable email/i.test(x.title))?.priority).toBe("high");
    expect(r.recommendations.find((x) => /phone number/i.test(x.title))?.priority).toBe("medium");
  });

  it("flags buzzword filler as low priority", () => {
    const r = runStructureRule(`${COMPLETE}\nA hardworking and passionate ninja.`);
    expect(r.findings.join(" ")).toMatch(/Buzzword filler spotted/);
    const rec = r.recommendations.find((x) => /buzzwords/i.test(x.title));
    expect(rec?.priority).toBe("low");
    expect(rec?.why).toMatch(/hardworking/);
  });
});
