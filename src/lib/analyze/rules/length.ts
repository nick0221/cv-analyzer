import type { DimensionResult, Recommendation } from "../../types";
import { extractBullets, wordCount, estimatePages, clamp } from "../text";

const IDEAL_MAX_LINES = 2; // a bullet should not wrap past ~2 lines

/** Length, page count and bullet density - too long and recruiters skim past. */
export function runLengthRule(text: string): DimensionResult {
  const wc = wordCount(text);
  const pages = estimatePages(text);
  const bullets = extractBullets(text);
  const findings: string[] = [];
  const recommendations: Recommendation[] = [];

  findings.push(`Approx. ${wc} words, which reads as ~${pages} page(s).`);
  findings.push(`${bullets.length} bullet point(s) detected.`);

  const avgBulletWords = bullets.length ? bullets.reduce((a, b) => a + wordCount(b), 0) / bullets.length : 0;
  const longBullets = bullets.filter((b) => wordCount(b) / 12 > IDEAL_MAX_LINES);
  findings.push(`Average bullet length is ${avgBulletWords.toFixed(1)} words.`);
  if (longBullets.length > 0) {
    findings.push(`${longBullets.length} bullet(s) run long enough to wrap past two lines.`);
  }

  let lengthScore: number;
  if (wc < 250) lengthScore = 45;
  else if (wc < 350) lengthScore = 65;
  else if (wc <= 900) lengthScore = 100;
  else if (wc <= 1200) lengthScore = 75;
  else lengthScore = 50;

  if (wc < 300) {
    recommendations.push({
      priority: "high",
      dimension: "length",
      title: "Resume is too thin",
      why: `Only ~${wc} words. There is not enough detail to show scope, tools, or results.`,
      fix: "Expand each role to 3-5 outcome-focused bullets and add a skills section with concrete tools and technologies.",
    });
  } else if (wc > 1100) {
    recommendations.push({
      priority: "high",
      dimension: "length",
      title: "Resume is too long",
      why: `~${wc} words / ${pages} pages exceeds the 1-2 page norm most recruiters expect.`,
      fix: "Cut roles older than ~10 years to one line, remove duplicates between your summary and bullets, and keep only the strongest 3-5 bullets per role.",
    });
  }

  if (longBullets.length > 0) {
    recommendations.push({
      priority: "medium",
      dimension: "length",
      title: `Tighten ${longBullets.length} overlong bullet(s)`,
      why: "Bullets longer than two lines get skimmed and their point is lost.",
      fix: "Split each long bullet into two, or cut the qualifiers and keep verb → action → result.",
    });
  }

  if (bullets.length > 0 && bullets.length < 6) {
    recommendations.push({
      priority: "medium",
      dimension: "length",
      title: "Add more achievement bullets",
      why: `Only ${bullets.length} bullets found - evidence of impact is sparse.`,
      fix: "Aim for 3-5 bullets for your two most recent roles and 2-3 for earlier ones.",
    });
  }

  const bulletPenalty = Math.min(20, longBullets.length * 4);
  const bulletBonus = bullets.length === 0 ? 0 : 5;
  const score = clamp(lengthScore - bulletPenalty + bulletBonus);

  return {
    key: "length",
    label: "Length & density",
    score,
    weight: 0.15,
    summary: `~${wc} words (~${pages} page(s)), ${avgBulletWords.toFixed(0)} words per bullet.`,
    findings,
    recommendations,
  };
}
