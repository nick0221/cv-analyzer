/**
 * Alias/canonicalization layer for keyword matching.
 *
 * ATS and human screeners treat these as the same skill, but stemmed token
 * overlap does not: "Postgres" and "PostgreSQL" share no stem, so the matcher
 * would wrongly report the requirement as missing. Each group is a set of
 * terms that should be considered identical; the first entry is the canonical
 * form used for comparison (and shown when useful).
 *
 * Keep this list to genuinely equivalent terms — near-synonyms that change
 * meaning (e.g. "lead" vs "manager") do not belong here.
 */
export const ALIAS_GROUPS: string[][] = [
  // Languages / shorthands
  ["javascript", "js", "ecmascript"],
  ["typescript", "ts"],
  ["python", "py"],
  ["golang", "go"],
  ["c#", "csharp", "c sharp"],
  ["c++", "cpp"],
  ["ruby", "rb"],
  // Databases
  ["postgresql", "postgres", "psql"],
  ["mysql", "mariadb"],
  ["mongodb", "mongo"],
  ["mssql", "sql server"],
  ["elasticsearch", "elastic search", "es"],
  // Cloud / infra
  ["kubernetes", "k8s"],
  ["amazon web services", "aws"],
  ["google cloud platform", "gcp", "google cloud"],
  ["microsoft azure", "azure"],
  ["continuous integration", "ci", "ci/cd", "cicd", "continuous delivery", "continuous deployment"],
  ["docker", "containerization", "containerisation"],
  ["terraform", "infrastructure as code", "iac"],
  // Frontend
  ["react", "react.js", "reactjs"],
  ["next.js", "nextjs", "next js"],
  ["vue", "vue.js", "vuejs"],
  ["angular", "angularjs"],
  ["node.js", "nodejs", "node"],
  ["tailwind", "tailwindcss"],
  // Practices / concepts
  ["machine learning", "ml"],
  ["artificial intelligence", "ai"],
  ["natural language processing", "nlp"],
  ["continuous monitoring", "observability", "monitoring"],
  ["rest", "restful", "rest api", "rest apis"],
  ["graphql", "gql"],
  ["test-driven development", "tdd"],
  ["user experience", "ux"],
  ["user interface", "ui"],
  ["search engine optimization", "seo"],
  ["human resources", "hr"],
  ["customer relationship management", "crm"],
  ["quality assurance", "qa"],
  ["project management", "pm"],
];

/** term (lowercased, punctuation-trimmed) -> canonical form. */
const CANONICAL: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const group of ALIAS_GROUPS) {
    const canonical = group[0];
    for (const term of group) {
      map.set(normalize(term), canonical);
    }
  }
  return map;
})();

/** Light normalization used as the alias-map key. */
function normalize(term: string): string {
  return term
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[./-]+|[./-]+$/g, "")
    .trim();
}

/**
 * Map a single token or multi-word phrase to its canonical alias, if any.
 * Applied BEFORE stemming so multi-word aliases ("machine learning") keep
 * their spaces and don't get chopped into separate stems.
 */
export function canonicalize(term: string): string {
  return CANONICAL.get(normalize(term)) ?? term;
}

/** Canonicalize (if aliased) then clean-stem a single token. */
export function canonicalStem(term: string, stem: (s: string) => string): string {
  const canonical = canonicalize(term);
  return stem(canonical);
}

/**
 * A single comparable key for a term: canonicalized, stemmed, and with inner
 * spaces replaced by "_" so multi-word terms ("machine learning") live in the
 * same flat key space as single tokens.
 */
export function canonicalKey(term: string, stem: (s: string) => string): string {
  const canonical = canonicalize(term);
  return stem(canonical).replace(/\s+/g, "_");
}

/**
 * Build the set of canonical keys present in a block of text.
 *
 * Two passes: (1) whole alias phrases, so "machine learning" is matched even
 * though it tokenizes to two words; (2) individual tokens, so single-word
 * aliases ("js", "postgres") resolve. `tokenize` is injected to avoid a
 * circular import with text.ts.
 */
export function canonicalKeysIn(
  text: string,
  tokenize: (s: string) => string[],
  stem: (s: string) => string,
): Set<string> {
  const lower = text.toLowerCase();
  const keys = new Set<string>();

  // 1) Multi-word alias phrases (and single-word aliases that appear verbatim).
  for (const group of ALIAS_GROUPS) {
    for (const alias of group) {
      if (!alias.includes(" ")) continue;
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(lower)) {
        keys.add(canonicalKey(alias, stem));
      }
    }
  }

  // 2) Individual tokens.
  for (const token of tokenize(text)) {
    keys.add(canonicalKey(token, stem));
  }

  return keys;
}

/** All group members for a canonical term — handy for explanations. */
export function aliasesOf(term: string): string[] {
  const canonical = canonicalize(term);
  const group = ALIAS_GROUPS.find((g) => g[0] === canonical);
  return group ? [...group] : [];
}
