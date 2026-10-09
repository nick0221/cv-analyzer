import type { MatchResult, Recommendation } from "../types";
import { stemClean, STOPWORDS, clamp } from "./text";

/** Lowercase tokens, keeping internal dots/dashes so "next.js" stays whole. */
function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z][a-z0-9'+#./-]*/g) ?? [];
  return raw
    .map((t) => t.replace(/^[./-]+|[./-]+$/g, ""))
    .filter((t) => t.length >= 2);
}

/** Whole-word tokens (for phrase-level presence checks). */
function wordTokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9+#./-]+/g) ?? [];
}

/** Whether every stemmed word of the phrase appears in the resume. */
function containsPhrase(resumeText: string, phrase: string): boolean {
  const phraseStems = phrase.split(/\s+/).map(stemClean);
  const resumeStems = new Set(wordTokens(resumeText).map(stemClean));
  return phraseStems.every((s) => resumeStems.has(s));
}

/** Count verbatim occurrences of a phrase in the resume (exact resonance). */
function phraseResonance(resumeText: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (resumeText.toLowerCase().match(new RegExp(`\\b${escaped}\\b`, "g")) ?? []).length;
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
    // Skip a single term already covered by a chosen bigram.
    if (chosen.some((c) => c.split(/\s+/).includes(s))) continue;
    chosen.push(s);
  }
  return chosen;
}

/** Terms from sentences the JD explicitly marks as "must-have". */
function extractMustHaveTerms(jobDescription: string, limit = 12): string[] {
  const sentences = jobDescription
    .split(/[.!?\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const mustSentences = sentences.filter((s) =>
    /\b(?:must|required|requires|essential|need|needs|minimum|you'll need|you will need|you have)\b/i.test(s),
  );

  const tokens = tokenize(mustSentences.join(" "));
  const counts = new Map<string, number>();
  for (const t of tokens) {
    if (t.length < 3 || STOPWORDS.has(t)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
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
      mustHaveFound: [],
      mustHaveMissing: [],
      buriedKeywords: [],
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

  // Must-have vs nice-to-have split using the JD's own language.
  const mustHave = extractMustHaveTerms(jd);
  const mustMissing = mustHave.filter((t) => !resumeStems.has(stemClean(t)) && !containsPhrase(resumeText, t));
  const mustFound = mustHave.filter((t) => !mustMissing.includes(t));

  if (mustMissing.length > 0) {
    recommendations.push({
      priority: "high",
      dimension: "ats",
      title: `Must-have requirement(s) not evidenced: ${mustMissing.slice(0, 6).join(", ")}`,
      why: `The job description marks these as required (must/essential/need), and your resume does not clearly show them: ${mustMissing.slice(0, 6).join(", ")}. ATS and screeners often filter on these before a human looks.`,
      fix: "Where true, add the missing skill or experience explicitly and near the top — in the summary and in a relevant bullet, not only in a skills list.",
    });
  }

  if (missing.length > 0) {
    recommendations.push({
      priority: missing.length > 6 ? "high" : "medium",
      dimension: "ats",
      title: `Add ${missing.length} keyword(s) from the job description`,
      why: `These terms in the posting are not matched in your resume: ${missing.slice(0, 12).join(", ")}. Many ATS systems rank candidates on exactly this overlap.`,
      fix: "Where the claim is true, work these terms into your skills section and existing bullets — do not keyword-stuff.",
    });
  }

  // Buried-keyword warning: a real skill/term that appears in the resume but
  // NEVER in the experience section — it only shows up in a trailing Skills
  // list or an old role, which is exactly where recruiters and parsers skim.
  // Generic section/filler words don't count (engineer, experience, skills…).
  const GENERIC_TERMS = new Set(["engineer", "engineering", "engineers", "experience", "skills", "skill", "summary", "education", "working", "company", "team", "role", "work", "job", "hiring", "required", "must", "nice", "have"]);
  const firstExperienceIdx = resumeText.toLowerCase().search(/\b(?:experience|employment|work history)\b/i);
  const buriedFound: string[] = [];
  if (firstExperienceIdx > 0) {
    const expEndGuess = resumeText.toLowerCase().search(/\b(?:education|skills|projects|awards|certifications)\b/i);
    const expSection = expEndGuess > firstExperienceIdx
      ? resumeText.slice(firstExperienceIdx, expEndGuess)
      : resumeText.slice(firstExperienceIdx);
    const expStems = new Set(tokenize(expSection).map(stemClean));
    for (const term of terms) {
      const stems = term.split(/\s+/).map(stemClean);
      if (stems.some((s) => GENERIC_TERMS.has(s))) continue;
      const presentAnywhere = stems.every((s) => resumeStems.has(s));
      const presentInExperience = stems.every((s) => expStems.has(s));
      if (presentAnywhere && !presentInExperience) buriedFound.push(term);
    }
  }
  if (buriedFound.length > 0) {
    recommendations.push({
      priority: "medium",
      dimension: "ats",
      title: `Keywords found but buried in the resume: ${buriedFound.slice(0, 6).join(", ")}`,
      why: `${buriedFound.slice(0, 6).join(", ")} appear in your resume but only below the experience section, which many parsers and recruiters skim past.`,
      fix: "Surface the most important keywords into your professional summary and the first two bullets of your current role.",
    });
  }

  if (missing.length === 0 && mustMissing.length === 0) {
    recommendations.push({
      priority: "low",
      dimension: "ats",
      title: "Strong keyword coverage",
      why: "Every salient term from the job description appears in the resume.",
      fix: "No action needed — keep the language aligned if you edit the resume.",
    });
  }

  // Exact-phrase resonance: does the resume literally echo the JD's phrases?
  const bigramPhrases = terms.filter((t) => t.includes(" "));
  const resonanceCount = bigramPhrases.reduce((acc, t) => acc + phraseResonance(resumeText, t), 0);
  if (resonanceCount === 0 && bigramPhrases.length > 0) {
    recommendations.push({
      priority: "low",
      dimension: "ats",
      title: "Mirror the job description's exact phrases",
      why: `The posting uses phrases like "${bigramPhrases.slice(0, 3).join('", "')}" and your resume never repeats them verbatim. Human screeners and newer AI-ATS both weight exact wording.`,
      fix: 'Where the claim is true, reuse the exact phrase from the posting (e.g. "GraphQL" as-is) in a sentence.',
    });
  }

  return {
    provided: true,
    score,
    keywordsFound: found,
    keywordsMissing: missing,
    mustHaveFound: mustFound,
    mustHaveMissing: mustMissing,
    buriedKeywords: buriedFound,
    recommendations,
  };
}