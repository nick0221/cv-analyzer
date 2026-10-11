import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits } from "../rateLimit";

/**
 * The two-phase AI flow calls /api/analyze then /api/ai for a single user
 * action. If both shared one counter, every AI analysis would cost 2 of the 10
 * per-minute budget — halving the effective limit and surprising the user with
 * a 429 on their ~6th resume. Each route must namespace its key.
 */
describe("rate limit namespacing", () => {
  beforeEach(() => resetRateLimits());

  it("keeps the analyze and ai budgets independent", () => {
    const ip = "1.2.3.4";
    // Exhaust the AI budget (10).
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(`ai:${ip}`).allowed).toBe(true);
    }
    expect(checkRateLimit(`ai:${ip}`).allowed).toBe(false);

    // The analyze budget for the same IP must be untouched.
    expect(checkRateLimit(`analyze:${ip}`).allowed).toBe(true);
  });

  it("still limits each scope on its own", () => {
    const ip = "5.6.7.8";
    for (let i = 0; i < 10; i++) expect(checkRateLimit(`analyze:${ip}`).allowed).toBe(true);
    const blocked = checkRateLimit(`analyze:${ip}`);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
