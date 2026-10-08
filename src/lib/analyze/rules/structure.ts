import type { DimensionResult, Recommendation } from "../../types";
import { paragraphs, splitLines, words } from "../text";

/** Section headings ATS parsers and recruiters expect to find. */
const REQUIRED_SECTIONS: Array<{ key: string; label: string; patterns: RegExp }> = [
  { key: "contact", label: "Contact details", patterns: /\b(email|@|phone|mobile|linkedin|github|portfolio|address)\b/i },
  { key: "summary", label: "Summary / Objective", patterns: /\b(summary|objective|profile|about)\b/i },
  { key: "experience", label: "Experience", patterns: /\b(experience|employment|work history|professional background)\b/i },
  { key: "education", label: "Education", patterns: /\b(education|academic|degree|university|bachelor|master|b\.?sc|m\.?sc)\b/i },
  { key: "skills", label: "Skills", patterns: /\b(skills|technologies|tech stack|competencies|expertise)\b/i },
];

export function runStructureRule(text: string): DimensionResult {
  const lines = splitLines(text);
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const found: string[] = [];
  const missing: string[] = [];

  for (const section of REQUIRED_SECTIONS) {
    const hit = section.patterns.test(text);
    if (hit) found.push(section.label);
    else missing.push(section.label);
  }

  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(text);
  const paraCount = paragraphs(text).length;

  const findings: string[] = [
    `Detected sections: ${found.length ? found.join(", ") : "none"}.`,
    hasEmail ? "An email address is present." : "No email address found in the contact block.",
    hasPhone ? "A phone number is present." : "No phone number detected.",
    `Content is split into ${paraCount} block(s) across ${nonEmpty.length} non-empty lines.`,
  ];

  const recommendations: Recommendation[] = [];
  if (missing.length > 0) {
    recommendations.push({
      priority: missing.length > 2 ? "high" : "medium",
      dimension: "structure",
      title: `Add the missing section${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
      why: `Standard headings help both recruiters and ATS parsers locate your content. Missing: ${missing.join(", ")}.`,
      fix: `Use plain, conventional headings - e.g. "Experience", "Education", "Skills". Avoid creative labels like "My Journey".`,
    });
  }
  if (!hasEmail) {
    recommendations.push({
      priority: "high",
      dimension: "structure",
      title: "Put a reachable email in the header",
      why: "No email address was detected, so a recruiter cannot contact you from the resume alone.",
      fix: "Add a plain-text email on line one next to your name, ideally a professional address (firstname.lastname@…).",
    });
  }
  if (!hasPhone) {
    recommendations.push({
      priority: "medium",
      dimension: "structure",
      title: "Add a phone number",
      why: "No phone number pattern was found in the document.",
      fix: "Add a phone number in international format, e.g. +1 555 123 4567.",
    });
  }

  // Filler words bloat the summary and waste the recruiter's first 6 seconds.
  const fillerWords = new Set(["hardworking", "hard-working", "passionate", "dynamic", "synergy", "guru", "ninja", "rockstar"]);
  const fillerHits = [...fillerWords].filter((w) => words(text).includes(w));
  if (fillerHits.length > 0) {
    findings.push(`Buzzword filler spotted: ${fillerHits.join(", ")}.`);
    recommendations.push({
      priority: "low",
      dimension: "structure",
      title: "Replace buzzwords with specifics",
      why: `Words like ${fillerHits.map((w) => `"${w}"`).join(", ")} describe everyone and differentiate no one.`,
      fix: "Swap each buzzword for a concrete fact or metric that proves the claim.",
    });
  }

  const score = Math.round((found.length / REQUIRED_SECTIONS.length) * 100);
  return {
    key: "structure",
    label: "Structure & sections",
    score,
    summary: `${found.length}/${REQUIRED_SECTIONS.length} standard sections detected.`,
    findings,
    recommendations,
  };
}
