import type { DimensionResult, Recommendation } from "../../types";
import { dateRangesIn, yearsIn, clamp } from "../text";

/** Evaluates the chronology/completeness of the experience section. */
export function runExperienceRule(text: string): DimensionResult {
  const findings: string[] = [];
  const recommendations: Recommendation[] = [];
  let score = 100;

  const hasExperience = /(?:experience|employment|work history|professional (?:background|experience))|(?:\b(?:worked|managed|led|built)\b)/i.test(text);
  const ranges = dateRangesIn(text);
  const years = yearsIn(text);
  const roleTitles = text.match(/\b(?:senior|lead|principal|staff|junior|intern|manager|director|head|founder|engineer|developer|analyst|designer|consultant|specialist|architect|scientist|coordinator|associate|officer)\b/gi) ?? [];
  const distinctTitles = [...new Set(roleTitles.map((t) => t.toLowerCase()))];

  if (!hasExperience) {
    score -= 40;
    findings.push("No experience/employment section detected.");
    recommendations.push({
      priority: "high",
      dimension: "structure",
      title: "Add a work experience section",
      why: "Without a clearly labeled Experience section, recruiters and ATS parsers cannot find your employment history.",
      fix: 'Add an "Experience" section listing your roles in reverse-chronological order with dates.',
    });
  } else {
    if (ranges.length === 0 && years.length === 0) {
      score -= 20;
      findings.push("No dates or date ranges found anywhere - the timeline is unreadable.");
      recommendations.push({
        priority: "high",
        dimension: "structure",
        title: "Add dates and date ranges to each role",
        why: "ATS engines and recruiters need start-end dates to place your experience on a timeline.",
        fix: 'Add "MMM YYYY - MMM YYYY" (or YYYY - YYYY) to every role and education entry.',
      });
    } else if (ranges.length === 0) {
      score -= 10;
      findings.push("Years are present but no clear start-end ranges.");
      recommendations.push({
        priority: "medium",
        dimension: "structure",
        title: "Convert bare years into date ranges",
        why: "Just a start year or a single year does not show how long you were in each role.",
        fix: 'Write every role as "MMM YYYY - MMM YYYY" (or YYYY - YYYY) and keep the format identical throughout.',
      });
    } else {
      findings.push(`${ranges.length} date range(s) detected.`);
    }

    if (distinctTitles.length === 0) {
      score -= 10;
      findings.push("No recognizable job titles found.");
      recommendations.push({
        priority: "medium",
        dimension: "structure",
        title: "Make job titles explicit",
        why: "Without clear titles, recruiters cannot judge seniority or progression.",
        fix: 'Put your actual job title (e.g. "Senior Software Engineer") in bold at the start of each role.',
      });
    } else {
      findings.push(`Roles reference ${distinctTitles.length} different title type(s).`);
    }

    // Career-gap heuristic: if the earliest year is far in the past but recent
    // experience sections are missing, or dates are sparse, call it out softly.
    if (years.length >= 2) {
      const sorted = years.map(Number).sort((a, b) => a - b);
      const span = sorted[sorted.length - 1] - sorted[0];
      if (span > 12 && ranges.length < 2) {
        score -= 5;
        findings.push(`Career spans ${span}+ years but with very few dated ranges.`);
        recommendations.push({
          priority: "low",
          dimension: "structure",
          title: "Make the career timeline explicit",
          why: `The dates span ${span}+ years, but only ${ranges.length} range(s) are present, so gaps or overlaps are unclear.`,
          fix: "Add start-end dates to every role so the timeline is complete and consistent.",
        });
      }
    }
  }

  return {
    key: "structure",
    label: "Experience & chronology",
    score: clamp(score),
    summary:
      !hasExperience
        ? "No experience section found."
        : `${ranges.length} date range(s), ${distinctTitles.length} title type(s).`,
    findings,
    recommendations,
  };
}