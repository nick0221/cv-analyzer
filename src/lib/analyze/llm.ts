import type { AnalysisResult, BulletRewrite, Recommendation, SecondOpinion } from "../types";
import { extractBullets, hasMetric } from "./text";

const SYSTEM_PROMPT = `You are an expert resume reviewer focused on ATS and recruiter readability.
You rewrite resume feedback to be concrete, specific, and actionable while staying truthful.
Rules:
- Never invent facts not present in the input. Only rephrase or tighten existing points.
- Keep every recommendation tied to the evidence provided.
- Prefer "do X by changing Y to Z" style fixes with concrete examples.
- Preserve priority (high/medium/low) and dimension meaning.
- Output only valid JSON matching the requested schema.
- Use clear, direct language. No buzzwords or fluff.
- When you rewrite a bullet, never fabricate a real number. If the metric is unknown,
  use a bracketed placeholder such as [X%], [N users] or [$ amount] and say so in "why".`;

export interface EnhancedRecommendation extends Recommendation {
  enhancedTitle?: string;
  enhancedWhy?: string;
  enhancedFix?: string;
}

export interface EnhanceResult {
  enhanced: boolean;
  model?: string;
  summary?: string;
  recommendations?: Array<{
    index: number;
    title?: string;
    why?: string;
    fix?: string;
  }>;
  bulletRewrites?: BulletRewrite[];
  secondOpinion?: SecondOpinion;
}

/** Caps: how many bullets and how much text we ship to the model. */
const MAX_BULLETS = 5;
const MAX_RESUME_CHARS = 6000;

/**
 * Bullets the engine would flag as unquantified — the only ones worth rewriting.
 * Sending a bounded, pre-filtered set keeps the prompt small (cheap) and lets us
 * validate the model's output against exactly what we asked about.
 */
export function unquantifiedBullets(text: string): string[] {
  return extractBullets(text)
    .filter((b) => !hasMetric(b))
    .filter((b) => b.split(/\s+/).length >= 4)
    .slice(0, MAX_BULLETS);
}

function buildPayload(result: AnalysisResult, text: string, jobDescription: string) {
  return {
    resumeText: text.slice(0, MAX_RESUME_CHARS),
    // Only when the user pasted a target job description.
    jobDescription: jobDescription ? jobDescription.slice(0, 3000) : undefined,
    score: result.score,
    grade: result.grade,
    wordCount: result.wordCount,
    bulletCount: result.bulletCount,
    estimatedPages: result.estimatedPages,
    // Bullets with no metric — the ones we ask the model to rewrite. Must live
    // in the payload, since that is what the model reads.
    unquantifiedBullets: unquantifiedBullets(text),
    dimensions: result.dimensions.map((d) => ({
      key: d.key,
      label: d.label,
      score: d.score,
      summary: d.summary,
      findings: d.findings,
    })),
    recommendations: result.recommendations.map((r, i) => ({
      index: i,
      priority: r.priority,
      dimension: r.dimension,
      title: r.title,
      why: r.why,
      fix: r.fix,
    })),
    match: result.match,
    warnings: result.warnings,
  };
}

function callChat(
  url: string,
  apiKey: string,
  model: string,
  payload: string,
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: payload },
      ],
    }),
  });
}

const SCHEMA = `{"summary": string|null, "recommendations": [{"index": number, "title": string, "why": string, "fix": string}], "bulletRewrites": [{"original": string, "rewrite": string, "why": string}], "secondOpinion": {"summary": string, "strengths": string[], "concerns": string[], "verdict": string}}`;

function buildInstruction(hasJobDescription: boolean): string {
  return [
    "Rephrase the feedback to be more specific and actionable. Keep priorities and dimensions unchanged.",
    "Also do two things the deterministic rules engine cannot:",
    "1) For each entry in unquantifiedBullets (at most 5), rewrite it as: strong action verb + what was done + measurable result.",
    '   Use a bracketed placeholder like [X%] or [N users] for any number you cannot know from the resume, and explain why in "why".',
    '   Set "original" to the bullet exactly as provided. Never invent a specific real metric.',
    "2) Write a blunt recruiter second opinion: a 2-3 sentence summary, 2-4 strengths, 2-4 concerns,",
    '   and "verdict" of exactly one of: "Strong", "Competitive", "Needs work", "High risk".',
    hasJobDescription
      ? "A target job description is included — name the specific missing keywords where relevant."
      : "No job description was provided.",
    `Return JSON with this shape: ${SCHEMA}`,
  ].join("\n");
}

/** Keep only non-empty, trimmed strings. */
function strArray(v: unknown, max = 6): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Validate the model's bullet rewrites against the bullets we actually sent.
 * Guards against the model inventing bullets or attaching a rewrite to text
 * that was never in the resume.
 */
function parseBulletRewrites(v: unknown, allowed: string[]): BulletRewrite[] {
  if (!Array.isArray(v)) return [];
  const allowedSet = new Set(allowed);
  const out: BulletRewrite[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const original = typeof o.original === "string" ? o.original.trim() : "";
    const rewrite = typeof o.rewrite === "string" ? o.rewrite.trim() : "";
    if (!original || !rewrite) continue;
    if (!allowedSet.has(original)) continue; // only bullets we asked about
    out.push({
      original,
      rewrite,
      why: typeof o.why === "string" && o.why.trim() ? o.why.trim() : undefined,
    });
    if (out.length >= MAX_BULLETS) break;
  }
  return out;
}

function parseSecondOpinion(v: unknown): SecondOpinion | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary.trim() : "";
  if (!summary) return undefined;
  const verdictRaw = typeof o.verdict === "string" ? o.verdict.trim() : "";
  const verdict = ["Strong", "Competitive", "Needs work", "High risk"].find(
    (x) => x.toLowerCase() === verdictRaw.toLowerCase(),
  );
  return {
    summary,
    strengths: strArray(o.strengths, 4),
    concerns: strArray(o.concerns, 4),
    verdict,
  };
}

export async function enhanceAnalysis(
  result: AnalysisResult,
  text: string,
  opts: { apiKey?: string; model?: string; baseUrl?: string; jobDescription?: string } = {},
): Promise<EnhanceResult> {
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return { enhanced: false };

  const model = opts.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const rawBaseUrl = opts.baseUrl ?? process.env.OPENAI_BASE_URL ?? "";
  // Provider compatibility: Anthropic/Vercel endpoints often end in /v1 or /v1/;
  // OpenAI's /chat/completions sits directly under the versioned root.
  const baseUrl = rawBaseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");

  const url = `${baseUrl || "https://api.openai.com/v1"}/v1/chat/completions`;
  const jobDescription = opts.jobDescription ?? "";
  const bullets = unquantifiedBullets(text);
  const payload = `${buildInstruction(Boolean(jobDescription))}\nInput: ${JSON.stringify(buildPayload(result, text, jobDescription))}`;

  let response: Response;
  try {
    response = await callChat(url, apiKey, model, payload);
  } catch {
    return { enhanced: false };
  }

  if (!response.ok) return { enhanced: false };

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    return { enhanced: false };
  }

  const choices = data?.choices as Array<{ message?: { content?: string } }> | undefined;
  const content = choices?.[0]?.message?.content;
  if (!content) return { enhanced: false };

  let parsed: {
    summary?: string | null;
    recommendations?: Array<{ index: number; title?: string; why?: string; fix?: string }>;
    bulletRewrites?: unknown;
    secondOpinion?: unknown;
  };
  try {
    parsed = JSON.parse(content);
  } catch {
    return { enhanced: false };
  }

  return {
    enhanced: true,
    model: (data?.model as string | undefined) ?? model,
    summary: parsed.summary ?? undefined,
    recommendations: parsed.recommendations?.filter((r) => typeof r.index === "number"),
    // Only keep rewrites for bullets we actually sent (anti-hallucination).
    bulletRewrites: parseBulletRewrites(parsed.bulletRewrites, bullets),
    secondOpinion: parseSecondOpinion(parsed.secondOpinion),
  };
}

/** Apply enhancement to a copy of result (returns new object). */
export function applyEnhancement(
  result: AnalysisResult,
  enhancement: EnhanceResult,
): AnalysisResult {
  // Nothing came back at all — leave the deterministic result untouched.
  if (!enhancement.enhanced) return result;

  const recMap = new Map<number, { title?: string; why?: string; fix?: string }>();
  for (const r of enhancement.recommendations ?? []) {
    if (typeof r.index === "number") recMap.set(r.index, r);
  }

  const enhancedRecs = result.recommendations.map((r, i) => {
    const e = recMap.get(i);
    if (!e) return r;
    return {
      ...r,
      title: e.title?.trim() || r.title,
      why: e.why?.trim() || r.why,
      fix: e.fix?.trim() || r.fix,
    };
  });

  // Dimensions don't get a top-level summary override for now; keep deterministic.
  // The score, grade and per-dimension numbers are NEVER touched by the AI.
  return {
    ...result,
    recommendations: enhancedRecs,
    enhanced: true,
    enhancedModel: enhancement.model,
    enhancedSummary: enhancement.summary,
    bulletRewrites: enhancement.bulletRewrites?.length ? enhancement.bulletRewrites : undefined,
    secondOpinion: enhancement.secondOpinion,
  };
}
