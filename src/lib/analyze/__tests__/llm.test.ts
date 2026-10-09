import { describe, it, expect, vi, afterEach } from "vitest";
import { enhanceAnalysis, applyEnhancement } from "../llm";
import { analyzeResume } from "../engine";

const RESUME = `Jane Doe
jane@example.com | 2020 - 2023
Experience
- Led a team of 6 engineers, increasing conversion 23%.
- Built React and Next.js apps, cutting load time 45%.
Skills: TypeScript, React, Next.js, AWS, Docker, GraphQL
Education: BSc Computer Science 2018`;

function baseResult() {
  return analyzeResume(RESUME);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("enhanceAnalysis", () => {
  it("returns enhanced:false when no API key is configured", async () => {
    const r = await enhanceAnalysis(baseResult(), RESUME, { apiKey: "" });
    expect(r.enhanced).toBe(false);
  });

  it("parses a well-formed LLM response and rewrites recommendations", async () => {
    const result = baseResult();
    const first = result.recommendations[0];

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            model: "gpt-4o-mini",
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary: "Tighten the bullets and add dates.",
                    recommendations: [
                      { index: 0, title: "REWRITTEN TITLE", why: "REWRITTEN WHY", fix: "REWRITTEN FIX" },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const enhancement = await enhanceAnalysis(result, RESUME, { apiKey: "test-key" });
    expect(enhancement.enhanced).toBe(true);
    expect(enhancement.model).toBe("gpt-4o-mini");
    expect(enhancement.summary).toContain("Tighten");

    const applied = applyEnhancement(result, enhancement);
    expect(applied.enhanced).toBe(true);
    expect(applied.recommendations[0].title).toBe("REWRITTEN TITLE");
    expect(applied.recommendations[0].priority).toBe(first.priority); // priority preserved
    // Recommendations we didn't rewrite keep their original text.
    if (applied.recommendations.length > 1) {
      expect(applied.recommendations[1].title).toBe(result.recommendations[1].title);
    }
  });

  it("degrades gracefully on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const r = await enhanceAnalysis(baseResult(), RESUME, { apiKey: "test-key" });
    expect(r.enhanced).toBe(false);
  });

  it("degrades gracefully when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    const r = await enhanceAnalysis(baseResult(), RESUME, { apiKey: "test-key" });
    expect(r.enhanced).toBe(false);
  });

  it("degrades gracefully on malformed JSON from the model", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "this is not json" } }] }),
          { status: 200 },
        ),
      ),
    );
    const r = await enhanceAnalysis(baseResult(), RESUME, { apiKey: "test-key" });
    expect(r.enhanced).toBe(false);
  });

  it("applyEnhancement is a no-op when not enhanced", () => {
    const result = baseResult();
    const applied = applyEnhancement(result, { enhanced: false });
    expect(applied).toBe(result);
  });
});
