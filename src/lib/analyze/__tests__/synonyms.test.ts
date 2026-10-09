import { describe, it, expect } from "vitest";
import { matchJobDescription } from "../match";
import { canonicalize, canonicalKey, aliasesOf } from "../synonyms";
import { stemClean } from "../text";

describe("synonym canonicalization", () => {
  it("maps common shorthands to a canonical form", () => {
    expect(canonicalize("postgres")).toBe("postgresql");
    expect(canonicalize("k8s")).toBe("kubernetes");
    expect(canonicalize("JS")).toBe("javascript");
    expect(canonicalize("nodejs")).toBe("node.js");
    expect(canonicalize("cicd")).toBe("continuous integration");
  });

  it("leaves unknown terms untouched", () => {
    expect(canonicalize("welding")).toBe("welding");
  });

  it("gives aliased terms the same comparison key", () => {
    expect(canonicalKey("Postgres", stemClean)).toBe(canonicalKey("PostgreSQL", stemClean));
    expect(canonicalKey("aws", stemClean)).toBe(canonicalKey("Amazon Web Services", stemClean));
    expect(canonicalKey("ml", stemClean)).toBe(canonicalKey("Machine Learning", stemClean));
  });

  it("exposes the alias group members", () => {
    expect(aliasesOf("k8s")).toContain("kubernetes");
    expect(aliasesOf("js")).toContain("javascript");
  });
});

describe("JD matching across synonyms", () => {
  it("counts Postgres in the resume as satisfying a PostgreSQL requirement", () => {
    const resume = "Built services on Postgres and deployed with k8s.";
    const jd = "You will work with PostgreSQL daily. Kubernetes experience is required. PostgreSQL and Kubernetes are a must.";
    const m = matchJobDescription(resume, jd);
    expect(m.keywordsFound).toContain("postgresql");
    expect(m.keywordsFound).toContain("kubernetes");
    expect(m.keywordsMissing).not.toContain("postgresql");
    expect(m.keywordsMissing).not.toContain("kubernetes");
  });

  it("matches 'js' in the resume against a JavaScript requirement", () => {
    const resume = "Wrote js and TS for web apps.";
    const jd = "Strong JavaScript required. TypeScript is required for this role. JavaScript and TypeScript daily.";
    const m = matchJobDescription(resume, jd);
    expect(m.keywordsFound).toContain("javascript");
    expect(m.keywordsFound).toContain("typescript");
  });

  it("still reports a genuinely absent skill as missing", () => {
    const resume = "Built React apps with TypeScript.";
    const jd = "React and GraphQL required. You must know GraphQL and Rust.";
    const m = matchJobDescription(resume, jd);
    expect(m.keywordsFound).toContain("react");
    expect(m.keywordsMissing).toContain("graphql");
    expect(m.keywordsMissing).toContain("rust");
  });

  it("treats an AWS requirement as satisfied by Amazon Web Services", () => {
    const resume = "Deployed on Amazon Web Services with Terraform.";
    const jd = "Strong AWS experience required. Terraform and AWS are essential for this role.";
    const m = matchJobDescription(resume, jd);
    expect(m.keywordsMissing).not.toContain("aws");
    expect(m.mustHaveMissing).not.toContain("aws");
  });

  it("raises the match score when aliases are present", () => {
    const jd = "Must know PostgreSQL and Kubernetes. PostgreSQL and Kubernetes required.";
    const withoutSynonyms = matchJobDescription("Built services and deployed them.", jd);
    const withSynonyms = matchJobDescription("Built services on Postgres deployed with k8s.", jd);
    expect(withSynonyms.score).toBeGreaterThan(withoutSynonyms.score);
  });
});
