import type { DimensionResult, Recommendation } from "../../types";
import { urlsIn, profileLinks, splitLines } from "../text";

/**
 * Evaluates the contact block and external profiles.
 * A recruiters first 6 seconds: name, role, email, phone, and working links.
 */
export function runContactRule(text: string): DimensionResult {
  const findings: string[] = [];
  const recommendations: Recommendation[] = [];
  let score = 100;

  const lines = splitLines(text);
  const nonEmpty = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  // Contact block = first ~8 non-empty lines (header area).
  const header = nonEmpty.slice(0, 8).join("\n");

  // Email: is it in the header area AND valid-looking? Recruiters look at the top.
  const emailRe = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  const emailMatch = text.match(emailRe);
  const emailInHeader = emailRe.test(header);
  const hasEmail = Boolean(emailMatch);

  if (!hasEmail) {
    score -= 35;
    findings.push("No email address detected.");
    recommendations.push({
      priority: "high",
      dimension: "contact",
      title: "Add a reachable email address",
      why: "No email was found, so a recruiter has no direct way to contact you from the resume.",
      fix: "Put a professional address (firstname.lastname@…) in the header, next to your name.",
    });
  } else if (!emailInHeader) {
    score -= 12;
    findings.push("An email exists but is not in the header area.");
    recommendations.push({
      priority: "medium",
      dimension: "contact",
      title: "Move your email up into the header",
      why: "Your email is present but buried below the top of the document, where recruiters and parsers may miss it.",
      fix: "Place name, title, email, phone, and links together in the first 2-3 lines.",
    });
  }

  // Phone number pattern (international-friendly).
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(text);
  if (!hasPhone) {
    score -= 15;
    findings.push("No phone number detected.");
    recommendations.push({
      priority: "medium",
      dimension: "contact",
      title: "Add a phone number (optional but common)",
      why: "No phone number pattern was found. Many recruiters still call first.",
      fix: "Add a phone number in international format, e.g. +1 555 123 4567.",
    });
  }

  // Social / portfolio links.
  const links = urlsIn(text);
  const profiles = profileLinks(text);
  const hasLinkedIn = profiles.some((p) => /linkedin\.com/.test(p));
  const hasGithub = profiles.some((p) => /github\.com/.test(p));
  const hasPortfolio = profiles.some((p) => /portfolio|personal site|website|blog|gitlab|stackoverflow|medium/.test(p));

  if (!hasLinkedIn) {
    score -= 12;
    findings.push("No LinkedIn profile link found.");
    recommendations.push({
      priority: "medium",
      dimension: "contact",
      title: "Add your LinkedIn profile URL",
      why: "A LinkedIn link is the fastest way for a recruiter to validate your background.",
      fix: 'Add a full https://www.linkedin.com/in/… URL to the header. Do not use a shortened or searchable name without a profile URL.',
    });
  }
  if (!hasGithub && !hasPortfolio) {
    score -= 8;
    findings.push("No GitHub or portfolio link found (relevant for tech roles).");
    recommendations.push({
      priority: "low",
      dimension: "contact",
      title: "Add a GitHub or portfolio link",
      why: "For developer and technical roles, a link to code or projects adds credibility.",
      fix: "Add a https://github.com/… or portfolio URL. Keep repos private or tidy if you link them.",
    });
  }

  // Protocol hygiene: a link that is not https:// or is malformed.
  const badLinks = links.filter((u) => !/^https?:\/\//i.test(u));
  if (badLinks.length > 0) {
    score -= 10;
    findings.push(`Links without a proper scheme: ${badLinks.slice(0, 3).join(", ")}.`);
    recommendations.push({
      priority: "medium",
      dimension: "contact",
      title: "Use full https:// URLs for every link",
      why: "Bare links like 'linkedin.com/in/…' can be non-clickable or treated as unsafe, and some ATS systems drop them.",
      fix: "Write each profile as a full https:// URL (e.g. https://linkedin.com/in/yourname).",
    });
  } else if (links.length > 0) {
    findings.push(`${links.length} link(s) detected, all with a proper scheme.`);
  }

  // Location is a common recruiter filter.
  const hasLocation = /\b(?:city|location|based in|remote|hybrid|on-site|on site)\b/i.test(text) || /[A-Z][a-z]+,\s*[A-Z]{2}\b/.test(text);
  if (!hasLocation) {
    score -= 8;
    findings.push("No location or remote preference detected.");
    recommendations.push({
      priority: "low",
      dimension: "contact",
      title: "Add your location / remote preference",
      why: "Recruiters filter by geography; a missing location can exclude you from search results.",
      fix: "Add e.g. 'San Francisco, CA · Open to remote' near your contact details.",
    });
  }

  return {
    key: "contact",
    label: "Contact & links",
    score: Math.max(0, score),
    summary: emailMatch
      ? `${emailInHeader ? "Email in header" : "Email present"}, ${hasLinkedIn ? "LinkedIn" : "no LinkedIn"}, ${links.length} link(s).`
      : "No email found in contact block.",
    findings,
    recommendations,
  };
}