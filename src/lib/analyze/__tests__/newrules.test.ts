import { describe, it, expect } from "vitest";
import { runSkillsRule } from "../rules/skills";
import { runExperienceRule } from "../rules/experience";
import { runProfessionalismRule } from "../rules/professionalism";

describe("runSkillsRule", () => {
  it("rewards a solid skills section", () => {
    const text = `
Summary
Engineer.

Skills
React, Next.js, TypeScript, Node.js, PostgreSQL, AWS, Docker, GraphQL, Python, Kubernetes
`.trim();
    const r = runSkillsRule(text);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.findings.join(" ")).toMatch(/skills/);
  });

  it("penalizes a missing skills section", () => {
    const text = "I worked with React in my last job and with Node.js before that.";
    const r = runSkillsRule(text);
    // Mentions skills but lacks the dedicated section → docked, but not wrecked.
    expect(r.score).toBeLessThan(85);
    expect(r.recommendations.some((rec) => /skills section/i.test(rec.title))).toBe(true);
  });
});

describe("runExperienceRule", () => {
  it("flags a resume with no dates", () => {
    const text = `
Experience
Senior Engineer, Acme
- Built things.
- Led people.
`.trim();
    const r = runExperienceRule(text);
    expect(r.score).toBeLessThan(90);
    expect(r.recommendations.some((rec) => /dates|date range/i.test(rec.title))).toBe(true);
  });

  it("rewards date ranges and titles", () => {
    const text = `
Experience
Senior Software Engineer, Acme - Mar 2021 - Present
- Led a team.
Software Engineer, Globex - Jun 2018 - Feb 2021
- Shipped features.
`.trim();
    const r = runExperienceRule(text);
    expect(r.score).toBeGreaterThanOrEqual(90);
  });
});

describe("runProfessionalismRule", () => {
  it("penalizes a resume with no links", () => {
    const r = runProfessionalismRule("Jane Doe\nSummary\nExperience\nSkills");
    expect(r.recommendations.some((rec) => /link|profile/i.test(rec.title))).toBe(true);
  });

  it("rewards the presence of profile links", () => {
    const text = "Jane Doe\nlinkedin.com/in/jane | github.com/jane\nSkills\nReact, Node.js";
    const r = runProfessionalismRule(text);
    expect(r.score).toBeGreaterThanOrEqual(85);
  });
});