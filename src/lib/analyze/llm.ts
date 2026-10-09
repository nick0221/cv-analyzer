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
  /**
   * Why enhancement failed, when `enhanced` is false. Purely diagnostic — used
   * to surface a useful warning and a server log instead of a silent no-op.
   */
  reason?: "network" | "http" | "invalid-response" | "empty" | "unparseable";
  /** HTTP status from the provider, when reason is "http". */
  status?: number;
  /** Truncated provider error body. Never contains the API key. */
  detail?: string;
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

/**
 * Build the request body. Two variants exist because OpenAI-compatible
 * providers are not uniformly compatible:
 *  - "primary": the modern shape (single user message, max_completion_tokens,
 *    JSON object mode). Groq's gpt-oss models advise against a system role and
 *    use max_completion_tokens; OpenAI/Cloudflare/OpenRouter accept both.
 *  - "compat": the most conservative shape (no response_format, max_tokens),
 *    used as a one-shot retry so an unknown provider still has a chance.
 */
function requestBody(model: string, payload: string, variant: "primary" | "compat") {
  // Fold the system prompt into the user message: gpt-oss on Groq is trained
  // without a system role, and this is harmless for every other provider.
  const content = `${SYSTEM_PROMPT}\n\n${payload}`;
  const common = {
    model,
    temperature: 0.2,
    messages: [{ role: "user", content }],
  };
  if (variant === "primary") {
    return {
      ...common,
      // Generous cap: reasoning models (gpt-oss) bill reasoning tokens too.
      max_completion_tokens: 3000,
      response_format: { type: "json_object" },
    };
  }
  return { ...common, max_tokens: 3000 };
}

function callChat(
  url: string,
  apiKey: string,
  model: string,
  payload: string,
  variant: "primary" | "compat" = "primary",
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody(model, payload, variant)),
  });
}

/**
 * Tolerant JSON extraction. Reasoning models sometimes wrap JSON in prose or a
 * markdown fence; scanning for the first balanced object avoids losing a good
 * response to a cosmetic wrapper.
 */
function parseJsonLoose(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // fall through to salvage
  }
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], content];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      // try the next candidate
    }
  }
  return undefined;
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
  // Normalize to a bare origin/root, then append the versioned path once.
  // Providers differ: OpenAI/Groq want <root>/v1/chat/completions, and some
  // users paste a root that already ends in /v1 — strip that so we never emit
  // a doubled /v1/v1.
  const baseUrl = rawBaseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");

  const url = `${baseUrl || "https://api.openai.com"}/v1/chat/completions`;
  const jobDescription = opts.jobDescription ?? "";
  const bullets = unquantifiedBullets(text);
  const payload = `${buildInstruction(Boolean(jobDescription))}\nInput: ${JSON.stringify(buildPayload(result, text, jobDescription))}`;

  let response: Response;
  try {
    response = await callChat(url, apiKey, model, payload, "primary");
    // A provider that rejects the modern shape (unknown max_tokens /
    // response_format rules) gets one conservative retry before we give up.
    if (response.status === 400 || response.status === 422) {
      response = await callChat(url, apiKey, model, payload, "compat");
    }
  } catch {
    return { enhanced: false, reason: "network" };
  }

  if (!response.ok) {
    // Capture the provider's message so a misconfigured model/param is visible
    // instead of a silent no-op. Never includes the key.
    let detail = "";
    try {
      const body = await response.text();
      detail = body.slice(0, 300);
    } catch {
      // ignore
    }
    return { enhanced: false, reason: "http", status: response.status, detail };
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    return { enhanced: false, reason: "invalid-response" };
  }

  const choices = data?.choices as Array<{ message?: { content?: string } }> | undefined;
  const content = choices?.[0]?.message?.content;
  if (!content) return { enhanced: false, reason: "empty" };

  const parsedAny = parseJsonLoose(content) as
    | {
        summary?: string | null;
        recommendations?: Array<{ index: number; title?: string; why?: string; fix?: string }>;
        bulletRewrites?: unknown;
        secondOpinion?: unknown;
      }
    | undefined;
  if (!parsedAny) return { enhanced: false, reason: "unparseable" };
  const parsed = parsedAny;

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
