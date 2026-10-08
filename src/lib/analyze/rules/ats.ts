import type { DimensionResult, Recommendation } from "../../types";
import { splitLines, clamp } from "../text";

/** Heuristic ATS-safety checks that can be inferred from extracted text. */
export function runAtsRule(text: string): DimensionResult {
  const findings: string[] = [];
  const recommendations: Recommendation[] = [];
  let score = 100;

  // 1. Multi-column layouts collapse into mangled, alternating lines when parsed.
  const lines = splitLines(text);
  const shortLines = lines.filter((l) => l.trim().length > 0 && l.trim().length < 28).length;
  const nonEmpty = lines.filter((l) => l.trim().length > 0).length || 1;
  const shortRatio = shortLines / nonEmpty;
  if (shortRatio > 0.55 && nonEmpty > 15) {
    findings.push(`${(shortRatio * 100).toFixed(0)}% of lines are very short - typical of a multi-column layout.`);
    score -= 15;
    recommendations.push({
      priority: "medium",
      dimension: "ats",
      title: "Consider a single-column layout",
      why: "Multi-column resumes often parse in the wrong order for ATS software, scrambling your job titles and dates.",
      fix: "Use one column with standard headings; move contact details into the main text flow rather than a sidebar.",
    });
  } else {
    findings.push("Text extracts in a clean, mostly full-width layout.");
  }

  // 2. Dates - ATS engines key on a recognizable date range per role.
  const dateCount = (text.match(/\b(?:19|20)\d{2}\b/g) ?? []).length;
  const monthRange = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(?:19|20)\d{2}\b/i.test(text);
  const hasRange = /\b(?:19|20)\d{2}\s*[-–to]+\s*(?:(?:19|20)\d{2}|present|current)\b/i.test(text);
  if (dateCount === 0) {
    findings.push("No 4-digit years found.");
    score -= 15;
    recommendations.push({
      priority: "high",
      dimension: "ats",
      title: "Add explicit dates to each role",
      why: "No years were detected, so the parser cannot place your experience on a timeline.",
      fix: 'Add a start-end range per role, e.g. "Mar 2022 - Present" or "2019 - 2021".',
    });
  } else if (!hasRange && !monthRange) {
    findings.push("Years are present but no clear employment ranges.");
    score -= 8;
    recommendations.push({
      priority: "medium",
      dimension: "ats",
      title: "Use consistent date ranges",
      why: "Years were found but not as clear start-end ranges, which can confuse experience calculations.",
      fix: 'Write every role as "MMM YYYY - MMM YYYY" (or "YYYY - YYYY") and keep the format identical throughout.',
    });
  } else {
    findings.push("Employment date ranges are present and parseable.");
  }

  // 3. Contact-in-header/footer is a classic ATS black hole.
  if (/(?:curriculum vitae|resume|page \d+ of \d+)/i.test(text)) {
    findings.push("Header/footer artifacts detected in extracted text.");
    recommendations.push({
      priority: "low",
      dimension: "ats",
      title: "Keep contact info out of headers and footers",
      why: "Running headers and footers are frequently skipped by parsers - the words above show the layout carries content there.",
      fix: "Put your name, email and phone in the body of the first page, not in the Word/PDF header or footer.",
    });
  }

  // 4. Special glyphs / emoji that break keyword matching.
  const glyphIssues = (text.match(/[\u2022\u25cf\u25aa\u2192\u2713\u274c\u2b50\u{1F300}-\u{1FAFF}]/gu) ?? []).length;
  if (glyphIssues > 3) {
    findings.push(`${glyphIssues} special symbols/emoji found.`);
    score -= 5;
    recommendations.push({
      priority: "low",
      dimension: "ats",
      title: "Limit decorative symbols and emoji",
      why: "Emoji and exotic glyphs can be stripped or misread by parsers and older ATS systems.",
      fix: "Use simple hyphens or round bullets, and keep emoji out of job titles and skills.",
    });
  }

  score = clamp(score);
  const summary = score >= 85 ? "ATS-friendly formatting." : score >= 65 ? "Mostly ATS-safe with a few risks." : "Several ATS parsing risks.";

  return {
    key: "ats",
    label: "ATS-safe formatting",
    score,
    weight: 0.15,
    summary,
    findings,
    recommendations,
  };
}
