import { NextRequest, NextResponse } from "next/server";
import { runDeterministic, runEnhancement } from "@/lib/analyzeFlow";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";

// The provider call is bounded by an AbortController; leave headroom for
// re-extraction + scoring. Separate route => not blocked by the analyze cap.
export const maxDuration = 30;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function badRequest(message: string, status = 400) {
  return json({ error: message }, status);
}

/**
 * Async AI hydration: the client calls this AFTER /api/analyze returned the
 * deterministic result, passing the same text/job description. We re-run the
 * deterministic analysis to build an identical payload, call the provider, and
 * return ONLY the AI fields + warnings. The deterministic score is unchanged
 * (it is never modified by the AI; this endpoint recomputes it and attaches
 * the AI output).
 */
export async function POST(req: NextRequest) {
  // Separate (lower) rate limit so a fast re-submit isn't throttled, but a
  // script hammering the provider is still stopped. Scoped so it does not
  // consume the /api/analyze budget (one analysis = 1 analyze + 1 ai).
  const rl = checkRateLimit(`ai:${clientKey(req)}`);
  if (!rl.allowed) {
    return json(
      { error: "Too many AI enhancement requests from this address. Please wait a minute and try again." },
      429,
    );
  }

  const consent = req.cookies.get("cv-consent")?.value;
  if (consent !== "accepted") {
    return badRequest("Consent is required before AI enhancement can process a resume.", 403);
  }

  if (!process.env.OPENAI_API_KEY) {
    return badRequest("AI enhancement is not configured on this deployment (no OPENAI_API_KEY).", 503);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return badRequest("Could not read the submitted form. Expected multipart/form-data.");
  }

  const started = Date.now();

  // Re-run the deterministic analysis so the payload the provider sees is
  // exactly the one the user was shown (identical text, same rules).
  const outcome = await runDeterministic(formData);
  if (!outcome.ok) return badRequest(outcome.error, outcome.status);
  const { result } = outcome;
  result.extractedText = result.extractedText ?? outcome.result.extractedText;

  const jobDescription = (formData.get("jobDescription") as string | null)?.trim() ?? "";

  const { result: enhanced, warnings } = await runEnhancement(result, result.extractedText ?? "", jobDescription);

  console.log(
    JSON.stringify({
      event: "ai",
      ms: Date.now() - started,
      words: result.wordCount,
      score: result.score,
      enhanced: Boolean(enhanced.enhanced),
      warnings: warnings.length,
      rateRemaining: rl.remaining,
    }),
  );

  return json({
    // Only the AI fields; the client merges these into the phase-1 result.
    enhanced: Boolean(enhanced.enhanced),
    enhancedModel: enhanced.enhancedModel,
    enhancedSummary: enhanced.enhancedSummary,
    bulletRewrites: enhanced.bulletRewrites,
    secondOpinion: enhanced.secondOpinion,
    warnings,
  });
}