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

export function hasMetric(text: string): boolean {
  // Currency, percentages, counts, magnitudes, durations, multipliers, years.
  return /(?:\d[\d,.]*\s*(?:%|percent|k\b|m\b|bn\b|x\b|hrs?\b|hours?\b|days?\b|weeks?\b|months?\b|years?\b|\+))|(?:[$€£]\s?\d)|(?:\b\d+(?:\.\d+)?\b)/i.test(
    text,
  ) && /\d/.test(text);
}
