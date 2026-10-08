import type { DimensionResult, Recommendation } from "../../types";
import { words, sentences, splitLines, clamp } from "../text";

/** A compact dictionary of the most common resume misspellings. */
const COMMON_MISSPELLINGS: Record<string, string> = {
  recieve: "receive",
  seperate: "separate",
  occured: "occurred",
  definately: "definitely",
  responsability: "responsibility",
  responsibile: "responsible",
  managment: "management",
  enviroment: "environment",
  acheive: "achieve",
  acheived: "achieved",
  sucessful: "successful",
  successfull: "successful",
  experiance: "experience",
  expereince: "experience",
  proffesional: "professional",
  proffessional: "professional",
  acheivements: "achievements",
  achievments: "achievements",
  comunication: "communication",
  collaberate: "collaborate",
  developement: "development",
  knowlege: "knowledge",
  levearage: "leverage",
  oppurtunity: "opportunity",
  perfomance: "performance",
  prioritise: "prioritize",
  responsibilty: "responsibility",
  sucess: "success",
  technnology: "technology",
  utilites: "utilities",
  wich: "which",
  teh: "the",
  adress: "address",
};

function personVoice(text: string): boolean {
  // First person pronouns ("I managed...", "my team") read as informal on a resume.
  return /\b(?:i|i'm|i've|my|me)\b(?=\s+[a-z])/i.test(text);
}

/** Spelling, repeated words, first person and inconsistent tense. */
export function runLanguageRule(text: string): DimensionResult {
  const findings: string[] = [];
  const recommendations: Recommendation[] = [];
  let score = 100;

  const lowerWords = words(text);

  // Touch typo detection
  const typos = Object.keys(COMMON_MISSPELLINGS).filter((k) => lowerWords.includes(k));
  if (typos.length > 0) {
    score -= Math.min(30, typos.length * 8);
    findings.push(`Common misspellings found: ${typos.join(", ")}.`);
    recommendations.push({
      priority: typos.length > 2 ? "high" : "medium",
      dimension: "language",
      title: `Fix ${typos.length} likely misspelling(s)`,
      why: `Typos are one of the fastest ways to get filtered out. Found: ${typos.map((t) => `"${t}" → "${COMMON_MISSPELLINGS[t]}"`).join(", ")}.`,
      fix: "Run a spell-checker as a final pass and have a second person read the resume top to bottom.",
    });
  } else {
    findings.push("No common misspellings detected.");
  }

  // Doubled words ("the the", "and and")
  const doubled = new Set<string>();
  for (let i = 1; i < lowerWords.length; i++) {
    if (lowerWords[i] === lowerWords[i - 1] && lowerWords[i].length > 2) doubled.add(lowerWords[i]);
  }
  if (doubled.size > 0) {
    score -= 10;
    findings.push(`Repeated words: ${[...doubled].join(", ")}.`);
    recommendations.push({
      priority: "medium",
      dimension: "language",
      title: "Remove repeated words",
      why: `Duplicated words such as ${[...doubled].map((d) => `"${d}"`).join(", ")} suggest an unedited draft.`,
      fix: "Read the affected bullets aloud; the doubling is usually a leftover edit.",
    });
  }

  // First-person voice
  if (personVoice(text)) {
    score -= 8;
    findings.push("First-person pronouns (I / my) detected.");
    recommendations.push({
      priority: "low",
      dimension: "language",
      title: "Drop first-person pronouns",
      why: 'Resumes conventionally omit "I" and "my" - they waste space and read as less formal.',
      fix: 'Rewrite "I managed a team of 5" as "Managed a team of 5".',
    });
  }

  // Tense consistency: a mix of past and present inside experience bullets.
  const lines = splitLines(text).filter((l) => l.trim().length > 10);
  const tenseLines = lines.filter((l) => /^\s*(?:[-•*]\s*)?[A-Za-z]+(ed|ing)\b/.test(l));
  const past = tenseLines.filter((l) => /^\s*(?:[-•*]\s*)?[A-Za-z]+ed\b/.test(l)).length;
  const present = tenseLines.filter((l) => /^\s*(?:[-•*]\s*)?[A-Za-z]+ing\b/.test(l)).length;
  if (past >= 3 && present >= 3) {
    findings.push(`Mixed past (${past}) and present (${present}) verb forms.`);
    recommendations.push({
      priority: "low",
      dimension: "language",
      title: "Make verb tense consistent",
      why: `Bullets mix past (-ed) and present (-ing) forms (${past} vs ${present}).`,
      fix: "Use past tense for past roles and present tense only for your current role.",
    });
  }

  // Sentence length - very long sentences signal wordiness.
  const longSentences = sentences(text).filter((s) => /\s/.test(s) && s.split(/\s+/).length > 40).length;
  if (longSentences > 0) {
    score -= Math.min(8, longSentences * 2);
    findings.push(`${longSentences} very long sentence(s).`);
  }

  score = clamp(score);
  const summary = score >= 90 ? "Clean, well-edited language." : score >= 70 ? "Readable with minor editing issues." : "Several proofreading issues to fix.";

  return {
    key: "language",
    label: "Language & typos",
    score,
    summary,
    findings,
    recommendations,
  };
}
