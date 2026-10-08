/** Shared text primitives used by every rule module. */

/** Bullet glyphs common in exported resumes. */
const BULLET_PREFIX = /^\s*(?:[-•▪◦‣·*]|\u2022|\d+[.)]|[a-z][.)])\s+/i;

export function splitLines(text: string): string[] {
  return text.split("\n");
}

/** Lines that read as resume bullets (glyph-prefixed), trimmed and non-empty. */
export function extractBullets(text: string): string[] {
  return splitLines(text)
    .filter((line) => BULLET_PREFIX.test(line))
    .map((line) => line.replace(BULLET_PREFIX, "").trim())
    .filter((line) => line.length > 0);
}

export function stripBulletPrefix(line: string): string {
  return line.replace(BULLET_PREFIX, "").trim();
}

export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z'+#.-]*/g) ?? [];
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Sentences, roughly - used for density and passive-voice checks. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Light suffix stripping. Deliberately crude: it only needs to make
 * "managing"/"managed"/"management" collapse together for keyword overlap.
 */
export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length <= 3) return w;
  for (const suffix of ["ations", "ation", "ements", "ement", "ingly", "edly", "ing", "ed", "ies", "ly", "es", "s"]) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w;
}

/** Same as `stem` but also strips punctuation. Use for term/keyword matching. */
export function stemClean(word: string): string {
  return stem(word.replace(/^[./-]+|[./-]+$/g, ""));
}

export function stemSet(text: string): Set<string> {
  return new Set(words(text).map(stem));
}

export const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from",
  "has", "have", "he", "her", "his", "i", "in", "is", "it", "its", "of", "on",
  "or", "our", "she", "that", "the", "their", "them", "they", "this", "to",
  "was", "we", "were", "will", "with", "you", "your", "about", "also", "into",
  "over", "than", "then", "there", "these", "those", "using", "used", "use",
  // generic job-posting verbs/phrases that are never real skills
  "must", "need", "needs", "needed", "know", "knows", "knowing", "want", "wants",
  "looking", "look", "join", "joining", "required", "require", "requires",
  "preferred", "plus", "etc", "day", "days", "daily", "work", "working", "role",
  "job", "candidate", "candidates", "ability", "able", "strong", "good", "great",
  "will", "ensure", "ensuring", "help", "helping", "including", "include", "well",
  "who", "whom", "whose", "every", "each", "other", "others", "across", "within",
]);

/** Paragraphs = blank-line separated chunks. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Heuristic page estimate. A typical resume is ~450-550 words/page once
 * headings and spacing are accounted for.
 */
export function estimatePages(text: string): number {
  const wc = wordCount(text);
  return Math.max(1, Math.round((wc / 500) * 10) / 10);
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100;
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/** Match years of the form 2018, '19, or 2023-2024. */
export function yearsIn(text: string): string[] {
  return unique(text.match(/\b(?:19|20)\d{2}\b/g) ?? []);
}

/**
 * Match date ranges commonly found in resume experience/education lines:
 * "Mar 2021 - Present", "2019-2021", "06/2018 – 02/2021", "Jan 2020 to Jun 2022".
 */
export function dateRangesIn(text: string): string[] {
  return text.match(
    /\b(?:(?:19|20)\d{2}\s*[-–to]+\s*(?:(?:19|20)\d{2}|present|current))|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}\s*[-–to]{1,3}\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}|present|current))/gi,
  ) ?? [];
}

/** Matches URLs with a recognizable protocol. */
export function urlsIn(text: string): string[] {
  const re = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  const matches = text.match(re) ?? [];
  return unique(matches.map((u) => u.replace(/[),.;:]+$/, "")));
}

/** Matches common profile/social mentions even without a full URL. */
export function profileLinks(text: string): string[] {
  const found: string[] = [];
  for (const r of [
    /linkedin\.com\/in\/[a-z0-9_-]+/gi,
    /github\.com\/[a-z0-9_-]+/gi,
    /(?:portfolio|personal site|website|blog):?/gi,
    /gitlab\.com\/[a-z0-9_-]+/gi,
    /stackoverflow\.com\/users\//gi,
    /medium\.com\/@?[a-z0-9_-]+/gi,
  ]) {
    const m = text.match(r);
    if (m) found.push(...m);
  }
  return unique(found.map((u) => u.toLowerCase()));
}

/** Common tech/general skills worth spotting even when there is no dedicated section. */
const SKILL_SEED = new Set([
  "react", "next.js", "node.js", "node", "typescript", "javascript", "python",
  "java", "go", "rust", "c++", "c#", "php", "ruby", "swift", "kotlin", "sql",
  "postgresql", "postgres", "mysql", "mongodb", "redis", "graphql", "rest",
  "api", "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ci/cd",
  "git", "linux", "html", "css", "tailwind", "angular", "vue", "svelte",
  "express", "django", "flask", "spring", "rails", "laravel", "wordpress",
  "kafka", "rabbitmq", "elasticsearch", "hadoop", "spark", "airflow", "ml",
  "machine learning", "deep learning", "nlp", "pytorch", "tensorflow", "keras",
  "pandas", "numpy", "scikit-learn", "data", "analytics", "excel", "tableau",
  "power bi", "figma", "sketch", "photoshop", "illustrator", "jira", "confluence",
  "slack", "agile", "scrum", "kanban", "seo", "sem", "crm", "salesforce", "hubspot",
  "marketing", "sales", "recruiting", "finance", "accounting", "leadership",
  "communication", "collaboration", "management", "project management", "pmp",
]);

/**
 * Extract candidate skill tokens from the resume. Numbers, single letters and
 * common words are filtered; multi-word phrases stay intact.
 */
export function skillTokens(text: string): string[] {
  const lower = text.toLowerCase();
  const found = [...SKILL_SEED].filter((skill) => lower.includes(skill));
  // Also catch generic capitalized tech tokens not in the seed (e.g. "Agile", "Jenkins").
  const generic = lower.match(/\b[a-z][a-z0-9+.-]{2,}\b/g) ?? [];
  const freq = new Map<string, number>();
  for (const g of generic) {
    // ignore obvious non-skills
    if ([...STOPWORDS].includes(g) || g.length < 3) continue;
    freq.set(g, (freq.get(g) ?? 0) + 1);
  }
  const mostCommon = [...freq.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([w]) => w);
  return unique([...found, ...mostCommon].map((s) => s.trim()));
}

export function hasMetric(text: string): boolean {
  // Currency, percentages, counts, magnitudes, durations, multipliers, years.
  return /(?:\d[\d,.]*\s*(?:%|percent|k\b|m\b|bn\b|x\b|hrs?\b|hours?\b|days?\b|weeks?\b|months?\b|years?\b|\+))|(?:[$€£]\s?\d)|(?:\b\d+(?:\.\d+)?\b)/i.test(
    text,
  ) && /\d/.test(text);
}
