import { describe, it, expect } from "vitest";
import { extractJobTerms } from "../match";

describe("keyword term hygiene", () => {
  const JD = `We need a Senior Frontend Engineer. Must know React and Next.js.
GraphQL and Kubernetes required. TypeScript a plus. React and Next.js every day.
GraphQL is a must. We are looking for strong candidates who will work daily.`;

  it("strips trailing punctuation from terms", () => {
    const terms = extractJobTerms(JD);
    for (const t of terms) {
      expect(t).toBe(t.trim());
      expect(t).not.toMatch(/[.,;:!?]$/);
    }
  });

  it("drops generic job-posting filler words", () => {
    const terms = extractJobTerms(JD);
    for (const filler of ["must", "need", "know", "required", "plus", "day", "looking", "strong", "work", "daily"]) {
      expect(terms).not.toContain(filler);
    }
  });

  it("keeps real skills, including dotted ones", () => {
    const terms = extractJobTerms(JD);
    expect(terms).toContain("react");
    expect(terms).toContain("next.js");
  });
});
