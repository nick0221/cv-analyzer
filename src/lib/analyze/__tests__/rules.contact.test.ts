import { describe, it, expect } from "vitest";
import { runContactRule } from "../rules/contact";

describe("runContactRule", () => {
  const FULL = `Jane Doe
jane@example.com | +1 555 123 4567 | San Francisco, CA
https://linkedin.com/in/janedoe | https://github.com/janedoe

Experience
Senior Software Engineer, Acme - Mar 2021 - Present
- Led a team of 6 engineers.`;

  it("scores a complete contact block at 100", () => {
    const r = runContactRule(FULL);
    expect(r.key).toBe("contact");
    expect(r.score).toBe(100);
    expect(r.summary).toContain("Email in header");
    expect(r.summary).toContain("LinkedIn");
    expect(r.recommendations).toEqual([]);
  });

  it("takes the heaviest hit when no email exists", () => {
    // No email (-35), no phone (-15), no LinkedIn (-12), no GitHub/portfolio
    // (-8), no location (-8) => 22.
    const r = runContactRule("Jane Doe\nSummary\nJust a person.");
    expect(r.score).toBe(22);
    expect(r.findings).toContain("No email address detected.");
    expect(r.recommendations.find((x) => /reachable email/i.test(x.title))?.priority).toBe("high");
  });

  it("docks less when the email is present but not in the header area", () => {
    // Email far below the first 8 non-empty lines costs 12, not 35.
    const filler = Array.from({ length: 9 }, (_, i) => `Line ${i}`).join("\n");
    const r = runContactRule(`${filler}\nlate@example.com`);
    expect(r.findings).toContain("An email exists but is not in the header area.");
    expect(r.recommendations.find((x) => /move your email up/i.test(x.title))?.priority).toBe("medium");
    // 100 - 12 (late email) - 15 (no phone) - 12 (no linkedin) - 8 (no github) - 8 (no location)
    expect(r.score).toBe(45);
  });

  it("flags links with a www. origin as missing an https:// scheme", () => {
    // urlsIn() matches https:// and www. links; a bare scheme-less
    // "linkedin.com/in/..." is caught by profileLinks() instead, so the
    // bad-scheme finding only fires for www.-prefixed URLs.
    const r = runContactRule(`Jane Doe
jane@example.com
+1 555 123 4567
www.linkedin.com/in/janedoe
Austin, TX`);
    expect(r.findings.some((f) => /without a proper scheme/.test(f))).toBe(true);
    expect(r.findings.join(" ")).toMatch(/www\.linkedin\.com\/in\/janedoe/);
    expect(r.recommendations.find((x) => /full https/i.test(x.title))?.priority).toBe("medium");
    // 100 - 10 (bad www. scheme) - 8 (www. link doesn't satisfy portfolio check) = 82.
    expect(r.score).toBe(82);
  });

  it("still counts a scheme-less LinkedIn URL as a profile link", () => {
    const r = runContactRule(`Jane Doe
jane@example.com
+1 555 123 4567
linkedin.com/in/janedoe
Austin, TX`);
    // No "no LinkedIn" finding: profileLinks recognizes the bare domain.
    expect(r.findings).not.toContain("No LinkedIn profile link found.");
  });

  it("accepts a location given as City, ST", () => {
    const r = runContactRule("Jane Doe\njane@example.com\n+1 555 123 4567\nAustin, TX\nhttps://linkedin.com/in/jane\nhttps://github.com/jane");
    expect(r.findings).not.toContain("No location or remote preference detected.");
    expect(r.score).toBe(100);
  });

  it("reports 'Email present' in the summary when the email sits low", () => {
    const filler = Array.from({ length: 9 }, (_, i) => `Line ${i}`).join("\n");
    const r = runContactRule(`${filler}\nlate@example.com`);
    expect(r.summary).toContain("Email present");
    expect(r.summary).not.toContain("Email in header");
  });
});
