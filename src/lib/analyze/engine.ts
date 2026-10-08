import type { AnalysisResult, AnalyzeRequest, DimensionResult, Recommendation } from "../types";
import { runStructureRule } from "./rules/structure";
import { runImpactRule } from "./rules/impact";
import { runVerbsRule } from "./rules/verbs";
import { runLengthRule } from "./rules/length";
import { runAtsRule } from "./rules/ats";
import { runLanguageRule } from "./rules/language";
import { matchJobDescription } from "./match";
import { extractBullets, wordCount, estimatePages, unique } from "./text";
import { sortRecommendations } from "./lexicon";

export function gradeFor(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export interface AnalyzeOptions {
  /** Extracted page count, when a PDF supplied it. */
  pages?: number;
  /** Extra warnings collected during file extraction. */
  warnings?: string[];
}

/**
 * Run every dimension rule and assemble the weighted overall score.
 * Pure and synchronous so it is trivially unit-testable.
 */
export function analyzeResume(
  text: string,
  req: AnalyzeRequest = {},
  options: AnalyzeOptions = {},
): AnalysisResult {
  const trimmed = text.trim();
  const warnings = [...(options.warnings ?? [])];

  if (trimmed.length === 0) {
    return {
      score: 0,
      grade: "F",
      wordCount: 0,
      bulletCount: 0,
      estimatedPages: 0,
      dimensions: [],
      recommendations: [],
      match: { provided: false, score: 0, keywordsFound: [], keywordsMissing: [], recommendations: [] },
      warnings: ["No text to analyze."],
    };
  }

  const dimensions: DimensionResult[] = [
    runStructureRule(trimmed),
    runImpactRule(trimmed),
    runVerbsRule(trimmed),
    runLengthRule(trimmed),
    runAtsRule(trimmed),
    runLanguageRule(trimmed),
  ];

  const weightTotal = dimensions.reduce((sum, d) => sum + d.weight, 0) || 1;
  const weighted = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) / weightTotal;
  const score = Math.round(weighted);

  const match = matchJobDescription(trimmed, req.jobDescription);

  // Flatten, dedupe by title, and order high → low priority.
  const all: Recommendation[] = [
    ...dimensions.flatMap((d) => d.recommendations),
    ...match.recommendations,
  ];
  const seen = new Set<string>();
  const deduped = all.filter((r) => {
    const key = r.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const bullets = extractBullets(trimmed);
  if (bullets.length === 0) {
    warnings.push("No bullet points were found - converting duties to bullets will lift several scores at once.");
  }

  return {
    score,
    grade: gradeFor(score),
    wordCount: wordCount(trimmed),
    bulletCount: bullets.length,
    estimatedPages: estimatePages(trimmed),
    dimensions,
    recommendations: sortRecommendations(deduped),
    match,
    warnings: unique(warnings),
  };
}
