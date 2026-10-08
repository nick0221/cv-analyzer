import type { Recommendation } from "../types";

/**
 * Strong action verbs. A bullet should open with one; "Responsible for",
 * "Helped with", "Worked on" are the classic weak openers.
 */
export const STRONG_VERBS = new Set([
  "led", "lead", "managed", "built", "build", "created", "create", "designed",
  "developed", "develop", "implemented", "implement", "launched", "launch",
  "improved", "increase", "increased", "reduced", "delivered", "deliver",
  "drove", "drive", "owned", "own", "architected", "engineered", "automated",
  "automate", "optimized", "optimize", "scaled", "scale", "shipped", "ship",
  "streamlined", "streamline", "coordinated", "coordinate", "negotiated",
  "negotiate", "analyzed", "analyze", "researched", "research", "mentored",
  "mentor", "trained", "train", "hired", "founded", "found", "established",
  "establish", "initiated", "initiate", "executed", "execute", "generated",
  "generate", "grew", "grow", "accelerated", "accelerate", "cut", "produced",
  "produce", "transformed", "transform", "migrated", "migrate", "integrated",
  "integrate", "refactored", "refactor", "documented", "document", "presented",
  "present", "partnered", "partner", "spearheaded", "championed", "overhauled",
  "revamped", "consolidated", "standardized", "prioritized", "diagnosed",
  "resolved", "resolve", "led", "won", "achieved", "achieve", "conducted",
  "conduct", "directed", "direct", "organized", "organize", "planned", "plan",
  "forecasted", "budgeted", "secured", "secure", "expanded", "expand",
  "recruited", "recruit", "supervised", "supervise", "administered", "wrote",
  "write", "authored", "author", "modelled", "modeled",
]);

/** Openers that signal passive/padding language in a bullet. */
export const WEAK_OPENERS = [
  "responsible for",
  "worked on",
  "helped with",
  "helped to",
  "assisted with",
  "assisted in",
  "duties included",
  "tasked with",
  "involved in",
  "participated in",
  "was part of",
  "part of a team",
  "in charge of",
  "responsible for",
];

/** Words that make a bullet sound passive or filler-ish mid-sentence. */
export const FILLER_PHRASES = [
  "various tasks",
  "etc",
  "and more",
  "hard worker",
  "team player",
  "go-getter",
  "think outside the box",
  "detail-oriented",
  "results-driven",
  "self-starter",
  "excellent communication skills",
];

export function priorityWeight(p: Recommendation["priority"]): number {
  return p === "high" ? 0 : p === "medium" ? 1 : 2;
}

export function sortRecommendations(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority));
}
