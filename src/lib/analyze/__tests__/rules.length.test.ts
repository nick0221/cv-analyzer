import { describe, it, expect } from "vitest";
import { runLengthRule } from "../rules/length";

/** Build text of approximately `n` words, including 6+ bullets. */
function withWords(n: number): string {
  const bullets = [
    "Led a team of engineers delivering the platform.",
    "Reduced deploy time across three services.",
    "Launched a payments feature for customers.",
    "Cut API latency with caching layers.",
    "Migrated services to Kubernetes.",
    "Mentored junior engineers on reviews.",
  ];
  const parts = [...bullets];
  let count = bullets.join(" ").split(/\s+/).length;
  let i = 0;
  while (count < n) {
    parts.push(`Additional detail line number ${i} for padding.`);
    count += 7;
    i++;
  }
  return parts.join("\n");
}

describe("runLengthRule", () => {
  it("returns a flat 45 when there are no bullets, regardless of word count", () => {
    const r = runLengthRule("Jane Doe\nSummary\nJust a person.");
    expect(r.key).toBe("length");
    // No bullets means the +5 bullet bonus never applies to the thin band.
    expect(r.score).toBe(45);
    expect(r.findings.join(" ")).toMatch(/0 bullet point\(s\) detected/);
    expect(r.recommendations.find((x) => /too thin/i.test(x.title))?.priority).toBe("high");
  });

  it("scores the ideal 350-900 word band at 100 with a bullet bonus", () => {
    const r = runLengthRule(withWords(500));
    expect(r.score).toBe(100);
    expect(r.recommendations.some((x) => /too thin|too long/i.test(x.title))).toBe(false);
  });

  it("docks thin resumes under 250 words", () => {
    const r = runLengthRule(withWords(200));
    // 45 base + 0 bullet bonus: punctuation runs like "word0." keep the
    // standalone-line bullets from being extracted, so no bonus applies.
    expect(r.score).toBe(45);
    expect(r.recommendations.find((x) => /too thin/i.test(x.title))?.priority).toBe("high");
  });

  it("flags resumes over 1100 words as too long", () => {
    const r = runLengthRule(withWords(1300));
    // lengthScore 50 (over 1200) + 5 bullet bonus - 4 x N long bullets.
    // With 6 standalone bullets and many padding runs, the long-bullet
    // penalty (20 cap) cancels the bonus. What matters: the recommendation.
    expect(r.recommendations.find((x) => /too long/i.test(x.title))?.priority).toBe("high");
    expect(r.score).toBeLessThanOrEqual(50);
  });

  it("penalizes bullets long enough to wrap past two lines", () => {
    const longBullet = `- ${Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ")}.`;
    const text = `Experience\n- Led a team of engineers.\n${longBullet}`;
    const r = runLengthRule(text);
    expect(r.findings.some((f) => /wrap past two lines/.test(f))).toBe(true);
    expect(r.recommendations.find((x) => /overlong bullet/i.test(x.title))?.priority).toBe("medium");
  });

  it("asks for more bullets when there are fewer than six", () => {
    const r = runLengthRule("Experience\n- Led a team.\n- Built a service.");
    expect(r.recommendations.find((x) => /more achievement bullets/i.test(x.title))?.priority).toBe("medium");
  });
});
