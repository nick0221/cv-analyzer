import type { AnalysisResult, Recommendation } from "../types";

const SYSTEM_PROMPT = `You are an expert resume reviewer focused on ATS and recruiter readability.
You rewrite resume feedback to be concrete, specific, and actionable while staying truthful.
Rules:
- Never invent facts not present in the input. Only rephrase or tighten existing points.
- Keep every recommendation tied to the evidence provided.
- Prefer "do X by changing Y to Z" style fixes with concrete examples.
- Preserve priority (high/medium/low) and dimension meaning.
- Output only valid JSON matching the requested schema.
- Use clear, direct language. No buzzwords or fluff.`;

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
}

function buildPayload(result: AnalysisResult, text: string) {
  return {
    resumeText: text.slice(0, 6000),
    score: result.score,
    grade: result.grade,
    wordCount: result.wordCount,
    bulletCount: result.bulletCount,
    estimatedPages: result.estimatedPages,
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

export async function enhanceAnalysis(
  result: AnalysisResult,
  text: string,
  opts: { apiKey?: string; model?: string; baseUrl?: string } = {},
): Promise<EnhanceResult> {
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return { enhanced: false };

  const model = opts.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const baseUrl = opts.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1024,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Rephrase the feedback to be more specific and actionable. Keep priorities and dimensions unchanged. Return JSON with this shape: {"summary": string|null, "recommendations": [{"index": number, "title": string, "why": string, "fix": string}]}. Input: ${JSON.stringify(buildPayload(result, text))}`,
          },
        ],
      }),
    });

    if (!response.ok) return { enhanced: false };
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { enhanced: false };

    const parsed = JSON.parse(content) as {
      summary?: string | null;
      recommendations?: Array<{
        index: number;
        title?: string;
        why?: string;
        fix?: string;
      }>;
    };

    return {
      enhanced: true,
      model: data?.model ?? model,
      summary: parsed.summary ?? undefined,
      recommendations: parsed.recommendations?.filter((r) => typeof r.index === "number"),
    };
  } catch {
    return { enhanced: false };
  }
}

/** Apply enhancement to a copy of result (returns new object). */
export function applyEnhancement(
  result: AnalysisResult,
  enhancement: EnhanceResult,
): AnalysisResult {
  if (!enhancement.enhanced || !enhancement.recommendations?.length) return result;

  const recMap = new Map<number, { title?: string; why?: string; fix?: string }>();
  for (const r of enhancement.recommendations) {
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
  return {
    ...result,
    recommendations: enhancedRecs,
  };
}
