/**
 * Turn an AI enhancement failure into one actionable, user-facing line.
 * Shared by /api/analyze (blocking mode, kept for tests/back-compat) and
 * /api/ai (async hydration mode).
 */

export interface AiFailure {
  reason?: "network" | "timeout" | "http" | "invalid-response" | "empty" | "unparseable";
  status?: number;
  detail?: string;
}

export function aiWarning(e: AiFailure): string {
  switch (e.reason) {
    case "network":
      return "AI enhancement was requested but the AI service could not be reached; showing the standard analysis.";
    case "timeout":
      return "AI enhancement was requested but the AI service took too long to respond; showing the standard analysis. (Free-tier models can be slow — try a faster model via OPENAI_MODEL.)";
    case "http": {
      // A quota/billing rejection is the most common self-host failure and
      // deserves a clearer message than "HTTP 429".
      const d = e.detail ?? "";
      if (e.status === 429 || /insufficient_quota|credit_balance|quota/i.test(d)) {
        return "AI enhancement was requested but the AI account has no remaining credits or quota (HTTP 429). Showing the standard analysis — add credits, or point OPENAI_BASE_URL at a free provider.";
      }
      if (e.status === 401 || e.status === 403) {
        return `AI enhancement was requested but the API key was rejected (HTTP ${e.status}). Showing the standard analysis — check OPENAI_API_KEY.`;
      }
      if (e.status === 404 || /model/i.test(d)) {
        return `AI enhancement was requested but the configured model was not found (HTTP ${e.status}). Showing the standard analysis — check OPENAI_MODEL.`;
      }
      return `AI enhancement was requested but the AI service rejected it (HTTP ${e.status ?? "?"}). Showing the standard analysis — check OPENAI_MODEL and OPENAI_BASE_URL.`;
    }
    case "unparseable":
    case "invalid-response":
      return "AI enhancement returned an unexpected response; showing the standard analysis.";
    default:
      return "AI enhancement was requested but unavailable; showing the standard analysis.";
  }
}