import type { DimensionResult, Recommendation } from "../../types";
import { extractBullets, clamp, pct } from "../text";
import { STRONG_VERBS, WEAK_OPENERS, FILLER_PHRASES } from "../lexicon";

function firstWord(text: string): string {
  const m = text.toLowerCase().match(/[a-z][a-z'-]*/);
  return m ? m[0] : "";
}

/** Bullets should open with a strong action verb, not "Responsible for". */
export function runVerbsRule(text: string): DimensionResult {
  const bullets = extractBullets(text);
  const findings: string[] = [];
  const recommendations: Recommendation[] = [];

  if (bullets.length === 0) {
    return {
      key: "verbs",
      label: "Action verbs",
      score: 40,
      summary: "No bullets to evaluate for action verbs.",
      findings: ["No bullet points detected."],
      recommendations: [],
    };
  }

  const strong = bullets.filter((b) => STRONG_VERBS.has(firstWord(b)));
  const weakOpenerHits = bullets.filter((b) => {
    const lower = b.toLowerCase();
    return WEAK_OPENERS.some((opener) => lower.startsWith(opener));
  });
  const fillerHits = FILLER_PHRASES.filter((p) => text.toLowerCase().includes(p));

  const strongRatio = pct(strong.length, bullets.length);
  findings.push(`${strong.length} of ${bullets.length} bullets (${strongRatio.toFixed(0)}%) start with a strong action verb.`);
  if (weakOpenerHits.length > 0) {
    findings.push(`${weakOpenerHits.length} bullet(s) open with passive phrasing.`);
  }

  if (weakOpenerHits.length > 0) {
    const sample = weakOpenerHits[0].slice(0, 60);
    recommendations.push({
      priority: weakOpenerHits.length > 2 ? "high" : "medium",
      dimension: "verbs",
      title: `${weakOpenerHits.length} bullet(s) start with passive openers`,
      why: 'Phrases like "Responsible for" and "Helped with" describe a job description, not your impact.',
      fix: `Rewrite the opener as a strong verb - e.g. "${sample}…" becomes "Owned …", "Delivered …", or "Reduced …".`,
    });
  }

  if (strongRatio < 50) {
    recommendations.push({
      priority: "medium",
      dimension: "verbs",
      title: "Start more bullets with strong action verbs",
      why: `Only ${strongRatio.toFixed(0)}% of bullets open with a strong verb such as Led, Built, Reduced or Launched.`,
      fix: "Open every bullet with an action verb; drop the pronoun and the article to keep it tight.",
    });
  }

  if (fillerHits.length > 0) {
    recommendations.push({
      priority: "low",
      dimension: "verbs",
      title: "Cut filler phrases",
      why: `Found: ${fillerHits.map((f) => `"${f}"`).join(", ")}. These add words without adding evidence.`,
      fix: "Delete each phrase or replace it with a specific, verifiable claim.",
    });
  }

  const score = clamp(Math.round(strongRatio * 0.7 + (weakOpenerHits.length === 0 ? 30 : 10)));
  return {
    key: "verbs",
    label: "Action verbs",
    score,
    summary: `${strongRatio.toFixed(0)}% of bullets lead with a strong verb.`,
    findings,
    recommendations,
  };
}
