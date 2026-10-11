import { NextRequest, NextResponse } from "next/server";
import { runDeterministic } from "@/lib/analyzeFlow";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";

// Give large PDFs room to parse on Vercel. (Node runtime is the default.)
export const maxDuration = 30;

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

function badRequest(message: string, status = 400) {
  return json({ error: message }, status);
}

export async function POST(req: NextRequest) {
  // Rate limit first: cheap, and protects the expensive parsing below.
  const rl = checkRateLimit(`analyze:${clientKey(req)}`);
  if (!rl.allowed) {
    return json(
      { error: "Too many analyses from this address. Please wait a minute and try again." },
      429,
      { "Retry-After": String(rl.retryAfterSeconds) },
    );
  }

  // Consent is required before any CV data is processed, enforced server-side too.
  const consent = req.cookies.get("cv-consent")?.value;
  if (consent !== "accepted") {
    return badRequest(
      "You must accept the data-usage notice before analyzing a resume. Please reload the page and accept the consent banner.",
      403,
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return badRequest("Could not read the submitted form. Expected multipart/form-data.");
  }

  const wantsAi = ["aiEnhance", "useAiEnhance"].some((k) => {
    const v = formData.get(k);
    return v === "1" || v === "true";
  });

  const started = Date.now();
  const outcome = await runDeterministic(formData);
  if (!outcome.ok) return badRequest(outcome.error, outcome.status);
  // The analyzed text is already echoed by runDeterministic.
  const { result } = outcome;

  // The AI enhancement is async/hydrated via a second call so the
  // deterministic score is never blocked by a slow provider.
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
  if (wantsAi) {
    if (aiConfigured) result.aiStatus = "pending";
    else
      result.warnings.push(
        "AI enhancement is not configured on this deployment (no OPENAI_API_KEY), so the standard analysis was used.",
      );
  }

  console.log(
    JSON.stringify({
      event: "analyze",
      ms: Date.now() - started,
      words: result.wordCount,
      score: result.score,
      dimensions: result.dimensions.length,
      recs: result.recommendations.length,
      enhanced: false,
      aiStatus: result.aiStatus ?? "none",
      rateRemaining: rl.remaining,
    }),
  );
  return json(result);
}