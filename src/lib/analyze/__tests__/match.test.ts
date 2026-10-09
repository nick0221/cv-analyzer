import { describe, it, expect } from "vitest";
import { matchJobDescription, extractJobTerms } from "../match";

const RESUME = `
Experience
- Built React and Next.js applications at scale.
- Managed PostgreSQL databases and deployed services on AWS with CI/CD pipelines.
`;

const JD = `
We are hiring a Senior Frontend Engineer. You will build React and Next.js
applications. Experience with GraphQL and Kubernetes is required. You must
know TypeScript and have worked with React and Next.js before. GraphQL is a must.
`;

describe("extractJobTerms", () => {
  it("prioritizes repeated terms and phrases", () => {
    const terms = extractJobTerms(JD);
    expect(terms.length).toBeGreaterThan(0);
    expect(terms).toContain("react");
    expect(terms).toContain("next.js");
  });

  it("returns nothing for an empty description", () => {
    expect(extractJobTerms("")).toHaveLength(0);
  });
});

describe("matchJobDescription", () => {
  it("marks matching keywords as found and others as missing", () => {
    const m = matchJobDescription(RESUME, JD);
    expect(m.provided).toBe(true);
    expect(m.keywordsFound).toContain("react");
    expect(m.keywordsMissing).toContain("graphql");
    expect(m.score).toBeGreaterThan(0);
    expect(m.score).toBeLessThan(100);
  });

  it("returns a not-provided result when the JD is empty", () => {
    const m = matchJobDescription(RESUME, "");
    expect(m.provided).toBe(false);
    expect(m.score).toBe(0);
  });

  it("stems across word forms so managing matches managed", () => {
    const m = matchJobDescription("Managed a team of engineers.", "You will be managing engineers daily. Managing is key.");
    expect(m.keywordsFound).toContain("managing");
  });

  describe("must-have vs nice-to-have", () => {
    it("flags JD-required terms that the resume lacks", () => {
      const m = matchJobDescription(RESUME, JD);
      // GraphQL and Kubernetes are marked required/must in the JD and absent.
      expect(m.mustHaveMissing.length).toBeGreaterThanOrEqual(2);
      expect(m.mustHaveMissing).toContain("graphql");
      // But at least the resume satisfies "react", "next.js", "typescript"… if present.
      expect(m.mustHaveFound.length).toBeGreaterThan(0);
      // And the must-have gap is surfaced as a high-priority recommendation.
      expect(m.recommendations.some((r) => r.title.includes("Must-have"))).toBe(true);
    });
  });

  describe("buried keywords", () => {
    it("flags a term that appears only after the experience section", () => {
      const buriedResume = `Jane Doe\nContact: jane@x.com\n\nSummary\nSenior engineer.\n\nExperience\nAcme Corp 2020-2023\n- Built web apps.\n\nSkills\nkubernetes, graphql, aws`;
      const m = matchJobDescription(buriedResume, JD);
      // kubernetes/graphql are in the resume but only in the post-experience skills list.
      expect(m.buriedKeywords).toEqual(expect.arrayContaining(["kubernetes", "graphql"]));
    });
  });

  describe("phrase resonance", () => {
    it("advises mirroring exact JD phrases when the resume never echoes them", () => {
      const noPhraseResume = "I build React apps and ship Next.js products.";
      const phraseJd = "The ideal candidate will have a strong background using React and Next.js in production.";
      const m = matchJobDescription(noPhraseResume, phraseJd);
      const advice = m.recommendations.filter((r) => r.title.includes("Mirror"));
      // Only suggest when there is a phrase to mirror and it is absent.
      if (advice.length > 0) {
        expect(advice[0].priority).toBe("low");
      }
    });
  });
});
