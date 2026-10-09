import { describe, it, expect } from "vitest";
import { runLanguageRule } from "../rules/language";

describe("runLanguageRule", () => {
  it("scores clean prose at 100", () => {
    const r = runLanguageRule("Led a team of 6 engineers. Reduced deploy time 40%.");
    expect(r.key).toBe("language");
    expect(r.score).toBe(100);
    expect(r.summary).toBe("Clean, well-edited language.");
    expect(r.findings).toContain("No common misspellings detected.");
  });

  it("penalizes common misspellings by 8 each", () => {
    const r = runLanguageRule("I recieve feedback and seperate the changes.");
    // 2 typos x 8 = 16, minus 8 for first-person "I" => 76.
    expect(r.score).toBe(76);
    expect(r.findings.join(" ")).toMatch(/recieve/);
    expect(r.recommendations.find((x) => /misspelling/i.test(x.title))?.priority).toBe("medium");
  });

  it("caps the misspelling penalty at 30 and escalates priority above 2 typos", () => {
    const r = runLanguageRule("recieve seperate occured definately responsability");
    // 5 typos x 8 = 40, capped at 30.
    expect(r.score).toBe(70);
    expect(r.recommendations.find((x) => /misspelling/i.test(x.title))?.priority).toBe("high");
  });

  it("detects doubled words", () => {
    const r = runLanguageRule("Managed the the platform for the team.");
    expect(r.score).toBe(90);
    expect(r.findings.join(" ")).toMatch(/Repeated words: the/);
    expect(r.recommendations.find((x) => /repeated words/i.test(x.title))?.priority).toBe("medium");
  });

  it("docks first-person voice but does not add a score penalty twice", () => {
    const r = runLanguageRule("I managed a team of 5 and my budget was $250K.");
    expect(r.score).toBe(92);
    expect(r.findings).toContain("First-person pronouns (I / my) detected.");
    expect(r.recommendations.find((x) => /first-person/i.test(x.title))?.priority).toBe("low");
  });

  it("flags mixed past and present verb forms", () => {
    // Needs >= 3 lines starting with -ed and >= 3 starting with -ing.
    const text = [
      "Managed the platform.",
      "Delivered the roadmap.",
      "Reduced costs.",
      "Building new services.",
      "Leading the team.",
      "Mentoring juniors.",
    ].join("\n");
    const r = runLanguageRule(text);
    expect(r.findings.join(" ")).toMatch(/Mixed past \(3\) and present \(3\)/);
    expect(r.recommendations.find((x) => /verb tense/i.test(x.title))?.priority).toBe("low");
  });

  it("stays within 0-100 even with every problem stacked", () => {
    const r = runLanguageRule("I recieve seperate occured definately responsability managment enviroment the the");
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
