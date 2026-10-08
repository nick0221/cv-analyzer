import type { DimensionResult, Recommendation } from "../../types";
import { skillTokens, clamp } from "../text";

/** Evaluates the skills/technologies dimension. */
export function runSkillsRule(text: string): DimensionResult {
  const findings: string[] = [];
  const recommendations: Recommendation[] = [];
  let score = 100;

  const hasSkillsSection = /\b(skills|technologies|tech stack|competencies|core competencies|technical skills|expertise)\b/i.test(text);

  const skills = skillTokens(text);
  const breadth = skills.length;

  if (breadth === 0) {
    score -= 35;
    findings.push("No skills or technologies detected.");
    recommendations.push({
      priority: "high",
      dimension: "structure",
      title: "Add a dedicated Skills section",
      why: "Nothing read as a skill or technology, and ATS systems rank candidates on exactly this.",
      fix: 'Add a "Skills" section listing 6-12 concrete tools, languages and frameworks relevant to your target role.',
    });
  } else if (breadth < 6) {
    score -= 15;
    findings.push(`Only ${breadth} skills/technologies detected.`);
    recommendations.push({
      priority: "medium",
      dimension: "structure",
      title: "Expand the skills list",
      why: `Only ${breadth} skills found - recruiters expect to see a concrete toolset.`,
      fix: "List the specific tools you have used professionally, not just generic terms.",
    });
  } else if (breadth >= 12) {
    // A very long flat list reads as keyword-stuffing.
    score -= 5;
    findings.push(`${breadth} skills detected - consider grouping them.`);
    recommendations.push({
      priority: "low",
      dimension: "structure",
      title: "Group the skills list",
      why: `${breadth} items in one long list is hard to scan and can look like keyword-stuffing.`,
      fix: 'Split into grouped headings: "Languages", "Frameworks", "Tools", "Soft skills".',
    });
  } else {
    findings.push(`${breadth} distinct skills/technologies detected.`);
  }

  if (!hasSkillsSection) {
    score -= 10;
    findings.push("No dedicated Skills/Technologies section.");
    recommendations.push({
      priority: "medium",
      dimension: "structure",
      title: "Add a Skills section heading",
      why: "Recruiters skim for a skills block; ATS keyword matching needs it too.",
      fix: 'Place a "Skills" section after Experience with 6-12 relevant tools and technologies.',
    });
  } else {
    findings.push("A dedicated Skills/Technologies section is present.");
  }

  return {
    key: "skills",
    label: "Skills & technologies",
    score: clamp(score),
    summary:
      breadth >= 8 && hasSkillsSection
        ? `Solid breadth: ${breadth} skills detected with a dedicated section.`
        : `${breadth} skills detected${hasSkillsSection ? ", dedicated section present" : ", no dedicated section"}.`,
    findings,
    recommendations,
  };
}