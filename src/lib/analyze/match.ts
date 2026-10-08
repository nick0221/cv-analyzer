import type { MatchResult, Recommendation } from "../types";
import { stemClean, STOPWORDS, clamp } from "./text";

/** Lowercase tokens, keeping internal dots/dashes so "next.js" stays whole. */
function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z][a-z0-9'+#./-]*/g) ?? [];
  return raw
    .map((t) => t.replace(/^[./-]+|[./-]+$/g, ""))
    .filter((t) => t.length >= 2);
}

/** Pull salient keyword terms (uni/bi-grams) out of a job description. */
export function extractJobTerms(jobDescription: string, limit = 24): string[] {
  const tokens = tokenize(jobDescription);

  const singleCounts = new Map<string, number>();
  for (const t of tokens) {
    if (t.length < 3 || STOPWORDS.has(t)) continue;
    singleCounts.set(t, (singleCounts.get(t) ?? 0) + 1);
  }

  // Bigrams first - "machine learning" beats "machine" and "learning".
  const bigrams = new Map<string, number>();
  for (let i = 1; i < tokens.length; i++) {
    const a = tokens[i - 1];
    const b = tokens[i];
    if (STOPWORDS.has(a) || STOPWORDS.has(b)) continue;
    if (a.length < 3 || b.length < 3) continue;
    const phrase = `${a} ${b}`;
    bigrams.set(phrase, (bigrams.get(phrase) ?? 0) + 1);
  }

  const rankedBigrams = [...bigrams.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p);

  const rankedSingles = [...singleCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([w]) => w);

  const chosen: string[] = [];
  for (const b of rankedBigrams) {
    if (chosen.length >= limit) break;
    chosen.push(b);
  }
  for (const s of rankedSingles) {
    if (chosen.length >= limit) break;
    // skip a single term already covered by a chosen bigram
    if (chosen.some((c) => c.split(/\s+/).includes(s))) continue;
    chosen.push(s);
  }
  return chosen;
}

/**
 * Compare resume vs job description using stemmed token overlap so
 * "managing" matches "managed" and "management".
 */
export function matchJobDescription(resumeText: string, jobDescription?: string): MatchResult {
  const jd = (jobDescription ?? "").trim();
  if (jd.length < 40) {
    return {
      provided: false,
      score: 0,
      keywordsFound: [],
      keywordsMissing: [],
      recommendations: [],
    };
  }

  const resumeStems = new Set(tokenize(resumeText).map(stemClean));

  const terms = extractJobTerms(jd);
  const found: string[] = [];
  const missing: string[] = [];

  for (const term of terms) {
    const stems = term.split(/\s+/).map(stemClean);
    const hit = stems.every((s) => resumeStems.has(s));
    (hit ? found : missing).push(term);
  }

  const score = terms.length === 0 ? 0 : clamp(Math.round((found.length / terms.length) * 100));

  const recommendations: Recommendation[] = [];
  if (missing.length > 0) {
    recommendations.push({
      priority: missing.length > 6 ? "high" : "medium",
      dimension: "structure",
      title: `Add ${missing.length} keyword(s) from the job description`,
      why: `These terms in the posting are not matched in your resume: ${missing.slice(0, 12).join(", ")}. Many ATS systems rank candidates on exactly this overlap.`,
      fix: "Where the claim is true, work these terms into your skills section and existing bullets - do not keyword-stuff.",
    });
  } else {
    recommendations.push({
      priority: "low",
      dimension: "structure",
      title: "Strong keyword coverage",
      why: "Every salient term from the job description appears in the resume.",
      fix: "No action needed - keep the language aligned if you edit the resume.",
    });
  }

  return {
    provided: true,
    score,
    keywordsFound: found,
    keywordsMissing: missing,
    recommendations,
  };
}
