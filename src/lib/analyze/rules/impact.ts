import type { DimensionResult, Recommendation } from "../../types";
import { extractBullets, hasMetric, clamp, pct } from "../text";

/** Bullets with numbers are the single strongest predictor of a strong resume. */
export function runImpactRule(text: string): DimensionResult {
  const bullets = extractBullets(text);
  const quantified = bullets.filter(hasMetric);

  const findings: string[] = [];
  const recommendations: Recommendation[] = [];

  if (bullets.length === 0) {
    findings.push("No bullet points detected - results are read as prose paragraphs.");
    recommendations.push({
      priority: "high",
      dimension: "impact",
      title: "Convert prose into bullet points",
      why: "No bullets were found, so achievements are hard to scan and hard to quantify.",
      fix: "Rewrite each role as 3-5 short bullets: strong verb + what you did + measurable result.",
    });
    return {
      key: "impact",
      label: "Quantified impact",
      score: 25,
      summary: "No bullets to evaluate for measurable results.",
      findings,
      recommendations,
    };
  }

  const ratio = pct(quantified.length, bullets.length);
  findings.push(`${quantified.length} of ${bullets.length} bullets (${ratio.toFixed(0)}%) contain a number or metric.`);

  if (ratio < 30) {
    recommendations.push({
      priority: "high",
      dimension: "impact",
      title: `Quantify your bullets - only ${quantified.length}/${bullets.length} have metrics`,
      why: "Numbers make impact concrete and are what recruiters scan for first. Under 30% reads as a list of duties, not achievements.",
      fix: 'Add scale and outcome to each bullet: "Reduced deploy time 40%", "Managed $250K budget", "Grew users from 1K to 15K".',
    });
  } else if (ratio < 60) {
    recommendations.push({
      priority: "medium",
      dimension: "impact",
      title: "Push more bullets toward measurable outcomes",
      why: `${ratio.toFixed(0)}% of bullets are quantified; the strongest resumes sit above 60%.`,
      fix: "Aim for a number in at least two of every three bullets - %, time saved, revenue, users, team size, or cost.",
    });
  }

  // detect the most-recent-role weakness: bullets present but zero metrics up top
  const firstThird = bullets.slice(0, Math.max(1, Math.ceil(bullets.length / 3)));
  if (firstThird.length > 0 && firstThird.every((b) => !hasMetric(b))) {
    recommendations.push({
      priority: "medium",
      dimension: "impact",
      title: "Add metrics to your most recent role",
      why: "The bullets at the top of the resume carry the most weight, and none of the earliest ones include a number.",
      fix: "Lead your current/most recent role with your single best measurable win.",
    });
  }

  const score = clamp(Math.round(20 + ratio * 0.8));
  return {
    key: "impact",
    label: "Quantified impact",
    score,
    summary: `${ratio.toFixed(0)}% of bullets are quantified.`,
    findings,
    recommendations,
  };
}
