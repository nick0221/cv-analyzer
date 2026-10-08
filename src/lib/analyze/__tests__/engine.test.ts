import { describe, it, expect } from "vitest";
import { analyzeResume, gradeFor } from "../engine";
import type { Recommendation } from "../../types";
import { runImpactRule } from "../rules/impact";
import { runStructureRule } from "../rules/structure";
import { runVerbsRule } from "../rules/verbs";

const STRONG_RESUME = `
Jane Doe
jane.doe@example.com | +1 555 123 4567 | linkedin.com/in/janedoe

Summary
Senior software engineer with 8 years building high-scale web platforms.

Experience
Senior Software Engineer, Acme Corp - Mar 2021 - Present
- Led a team of 6 engineers to rebuild the checkout flow, increasing conversion 23%.
- Reduced page load time 45% by migrating to edge rendering, cutting $120K in infra costs.
- Shipped 14 features across 2023, growing monthly active users from 40K to 115K.
Software Engineer, Globex - Jun 2018 - Feb 2021
- Built a payments service processing $8M/month with 99.99% uptime.
- Automated regression tests, cutting release cycles from 5 days to 1 day.

Education
B.Sc. Computer Science, State University, 2018

Skills
TypeScript, React, Next.js, Node.js, PostgreSQL, AWS, CI/CD, GraphQL
`.trim();

const WEAK_RESUME = `
John Smith
Smith

I am a hardworking and passionate professional looking for opportunities.
I was responsible for various tasks in my previous role.
I helped with the team and worked on many projects.
I was part of a team that did things.
I recieve feedback well and I am a team player.
I am definately a self-starter.
`.trim();

describe("gradeFor", () => {
  it("maps score bands to letter grades", () => {
    expect(gradeFor(95)).toBe("A");
    expect(gradeFor(82)).toBe("B");
    expect(gradeFor(71)).toBe("C");
    expect(gradeFor(60)).toBe("D");
    expect(gradeFor(20)).toBe("F");
  });
});

describe("analyzeResume", () => {
  it("scores a strong, quantified resume clearly higher than a weak one", () => {
    const strong = analyzeResume(STRONG_RESUME);
    const weak = analyzeResume(WEAK_RESUME);
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBeGreaterThan(60);
    expect(weak.score).toBeLessThan(60);
  });

  it("returns every dimension and a well-formed result", () => {
    const result = analyzeResume(STRONG_RESUME);
    expect(result.dimensions).toHaveLength(9);
    expect(result.bulletCount).toBeGreaterThan(0);
    expect(result.grade).toBe(gradeFor(result.score));
    for (const d of result.dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  it("handles empty input without throwing", () => {
    const result = analyzeResume("   ");
    expect(result.score).toBe(0);
    expect(result.dimensions).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("dedupes recommendations by title", () => {
    const result = analyzeResume(WEAK_RESUME);
    const titles = result.recommendations.map((r) => r.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe("runStructureRule", () => {
  it("recognizes standard sections and contact info", () => {
    const r = runStructureRule(STRONG_RESUME);
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it("flags a resume missing contact details", () => {
    const r = runStructureRule("Summary\nExperience\nSkills");
    expect(r.recommendations.some((rec: Recommendation) => /email/i.test(rec.title))).toBe(true);
  });
});

describe("runImpactRule", () => {
  it("rates heavily quantified bullets highly", () => {
    const r = runImpactRule(STRONG_RESUME);
    expect(r.score).toBeGreaterThan(70);
  });

  it("flags a resume with no metrics in bullets", () => {
    const r = runImpactRule("- Managed the team\n- Built the product\n- Ran the project");
    expect(r.recommendations.some((rec: Recommendation) => /quantify/i.test(rec.title))).toBe(true);
  });
});

describe("runVerbsRule", () => {
  it("flags passive openers", () => {
    const r = runVerbsRule("- Responsible for the backlog\n- Helped with releases\n- Worked on features");
    expect(r.recommendations.some((rec: Recommendation) => /passive/i.test(rec.title))).toBe(true);
  });
});
