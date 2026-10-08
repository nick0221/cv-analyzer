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
});
