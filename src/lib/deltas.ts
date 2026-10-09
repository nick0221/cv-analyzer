/**
 * Recommendation "deltas" — turn each fix into a concrete, write-it-yourself
 * before/after edit, like the diff view a reviewer would leave on your resume.
 *
 * The intersection is deliberately tiny and dependency-free: a small set of
 * hand-written transforms keyed on stable substrings, then a generic
 * "tighten/strengthen" fallback. If a recommendation doesn't match anything,
 * we return `null` and the UI simply hides the diff for that card.
 */
export interface Delta {
  before: string;
  after: string;
}

const TRANSFORMS: Array<{ match: RegExp; before: string; after: string }> = [
  // ── Passive / filler openers ─────────────────────────────────────────
  { match: /responsible for/i, before: "Responsible for", after: "Owned" },
  { match: /helped with|helped to/i, before: "Helped with", after: "Delivered" },
  { match: /worked on/i, before: "Worked on", after: "Built" },
  { match: /involved in|participated in/i, before: "Involved in", after: "Contributed to" },
  { match: /in charge of/i, before: "In charge of", after: "Directed" },
  { match: /tasked with/i, before: "Tasked with", after: "Led" },
  { match: /assisted with|assisted in/i, before: "Assisted with", after: "Supported" },
  { match: /part of a team|was part of/i, before: "Was part of a team", after: "Contributed to a team" },
  { match: /duties included/i, before: "Duties included", after: "Delivered" },
  // ── Filler phrases anywhere ──────────────────────────────────────────
  { match: /various tasks/i, before: "various tasks", after: "your core deliverable" },
  { match: /and more/i, before: "and more", after: "your top three measurable wins" },
  { match: /hard worker|hardworking/i, before: "hardworking / hard worker", after: "2–3 proof points (metrics)" },
  { match: /team player/i, before: "team player", after: "something specific you did for a team" },
  { match: /go-getter|self-starter/i, before: "go-getter", after: "e.g. 'Raised our NPS by 12 pts'" },
  { match: /think outside the box/i, before: "think outside the box", after: "e.g. 'Shipped a novel A/B framework'" },
  { match: /detail-oriented/i, before: "detail-oriented", after: "e.g. 'Caught a $40K billing error'" },
  { match: /results-driven/i, before: "results-driven", after: "e.g. 'Drove 18% revenue growth'" },
  { match: /excellent communication skills/i, before: "excellent communication skills", after: "e.g. 'Presented to 50+ stakeholders monthly'" },
  // ── Quantify / add metrics ───────────────────────────────────────────
  { match: /reduced .*? time/i, before: "Reduced deploy time", after: "Reduced deploy time 40%" },
  { match: /improved performance/i, before: "Improved performance", after: "Improved performance by 32%" },
  { match: /grew|increased/i, before: "Grew revenue", after: "Grew revenue $1.2M → $2.4M" },
  // ── Structure ────────────────────────────────────────────────────────
  { match: /no experience|experience section/i, before: "No Experience section", after: "## Experience\nSenior Engineer — Acme · Mar 2021 – Present" },
  { match: /skills section/i, before: "No Skills section", after: "## Skills\nLanguages: …  Frameworks: …  Tools: …" },
  { match: /contact|email/i, before: "No email in header", after: "Jane Doe · jane@example.com · +1 555 123 4567" },
];

export function deltaFor(title: string, why: string, fix: string): Delta | null {
  const haystack = `${title} ${why} ${fix}`;
  for (const t of TRANSFORMS) {
    if (t.match.test(haystack)) return { before: t.before, after: t.after };
  }
  return null;
}