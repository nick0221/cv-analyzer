import type { DimensionResult, Recommendation } from "../../types";
import { urlsIn, profileLinks, clamp } from "../text";

/** Evaluates professional signaling: links, awards, and general polish. */
export function runProfessionalismRule(text: string): DimensionResult {
  const findings: string[] = [];
  const recommendations: Recommendation[] = [];
  let score = 100;

  const urls = urlsIn(text);
  const profiles = profileLinks(text);
  const largeURLs = urls.filter((u) => u.length > 12);
  const totalLinks = new Set([...urls, ...profiles]).size;

  if (totalLinks === 0) {
    score -= 12;
    findings.push("No portfolio, GitHub, LinkedIn, or website links found.");
    recommendations.push({
      priority: "medium",
      dimension: "structure",
      title: "Add a link to your professional profile",
      why: "A LinkedIn/GitHub/portfolio link gives recruiters a fast way to verify your work and skills.",
      fix: 'Add one or two links (LinkedIn, GitHub, portfolio) in the header or contact section - keep them short and clean.',
    });
  } else {
    const hasLinkedIn = profiles.some((p) => p.includes("linkedin"));
    const hasCode = profiles.some((p) => p.includes("github") || p.includes("gitlab"));
    const hasPortfolio = profiles.some((p) => /portfolio|website|personal/.test(p)) || largeURLs.length > 0;

    findings.push(`${totalLinks} profile/URL link(s) detected.`);
    if (hasLinkedIn) findings.push("LinkedIn link found.");
    if (hasCode) findings.push("Code repository link found.");
    if (hasPortfolio) findings.push("Portfolio/website link found.");

    if (!hasLinkedIn && !hasCode && !hasPortfolio) {
      score -= 4;
      recommendations.push({
        priority: "low",
        dimension: "structure",
        title: "Use recognizable profile links",
        why: "The links present are not obviously LinkedIn, GitHub, or a portfolio, so their value is muted.",
        fix: "Prefer well-known domains (linkedin.com/in/…, github.com/…) that recruiters recognize instantly.",
      });
    }
  }

  // Inconsistency: mixed date formats is a cheap professionalism signal.
  const yearDashYear = (text.match(/\b(?:19|20)\d{2}\s*-\s*(?:19|20)\d{2}\b/g) ?? []).length;
  const monthYear = (text.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}\b/gi) ?? []).length;
  if (yearDashYear > 0 && monthYear > 0) {
    score -= 5;
    findings.push("Mixed date formats (YYYY-YYYY and Month YYYY) detected.");
    recommendations.push({
      priority: "low",
      dimension: "structure",
      title: "Use one consistent date format",
      why: "Mixing YYYY-YYYY with Month YYYY looks careless and can confuse parsers.",
      fix: "Pick one format and apply it everywhere, e.g. Mar 2022 - Present for every role.",
    });
  }

  // Awards / certifications presence is a bonus signal.
  const awards = (text.match(/\b(award|recognition|certification|certified|honor|achievement|dean's list|scholarship)\b/gi) ?? []).length;
  if (awards > 0) {
    findings.push(`${awards} award/certification mention(s) found - good signal.`);
    score += 5;
  } else {
    findings.push("No awards, certifications, or honors mentioned.");
  }

  return {
    key: "professionalism",
    label: "Links & professional polish",
    score: clamp(score),
    summary:
      totalLinks > 0
        ? `${totalLinks} profile/URL link(s) found${awards > 0 ? `, ${awards} award/certification(s)` : ""}.`
        : "No profile links found.",
    findings,
    recommendations,
  };
}