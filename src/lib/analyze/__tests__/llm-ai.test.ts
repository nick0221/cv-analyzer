import { describe, it, expect, vi, afterEach } from "vitest";
import { enhanceAnalysis, applyEnhancement, unquantifiedBullets } from "../llm";
import { analyzeResume } from "../engine";
import { buildMarkdownReport } from "@/lib/report";

const RESUME = `Jane Doe
jane@example.com | 2020 - 2023
Experience
- Led a team of 6 engineers, increasing conversion 23%.
- Worked on the migration to a new billing system.
- Helped with onboarding new hires across three teams.
- Managed the on-call rotation.
Skills: TypeScript, React, Next.js, AWS, Docker, GraphQL
Education: BSc Computer Science 2018`;

function baseResult() {
  return analyzeResume(RESUME);
}

/** Build a fake OpenAI-compatible response carrying `content` as the assistant message. */
function mockLLM(content: string, model = "mock-model-1") {
  return vi.fn(
    async () =>
      new Response(
        JSON.stringify({ model, choices: [{ message: { content } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("unquantifiedBullets", () => {
  it("returns only bullets with no metric, ignoring quantified ones", () => {
    const out = unquantifiedBullets(RESUME);
    expect(out.some((b) => b.includes("Led a team of 6"))).toBe(false); // has a number
    expect(out.some((b) => b.includes("migration to a new billing system"))).toBe(true);
  });

  it("caps the number of bullets sent to the model", () => {
    const many = Array.from({ length: 20 }, (_, i) => `- Managed project number ${i} end to end.`)
      .join("\n");
    expect(unquantifiedBullets(many).length).toBeLessThanOrEqual(5);
  });
});

describe("provider compatibility (Groq / gpt-oss)", () => {
  /** Capture the parsed request body the app sends. */
  function captureBody(): () => Record<string, unknown> {
    let captured: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body?: string }) => {
        captured = JSON.parse(String(init?.body ?? "{}"));
        return new Response(
          JSON.stringify({ model: "m", choices: [{ message: { content: "{}" } }] }),
          { status: 200 },
        );
      }),
    );
    return () => captured;
  }

  it("sends NO system role and uses max_completion_tokens (gpt-oss on Groq rejects a system role)", async () => {
    const getBody = captureBody();
    await enhanceAnalysis(baseResult(), RESUME, { apiKey: "test" });
    const body = getBody();

    const messages = body.messages as Array<{ role: string }>;
    expect(messages).toBeDefined();
    expect(messages.every((m) => m.role === "user")).toBe(true);
    expect(JSON.stringify(messages)).not.toContain('"system"');

    expect(body.max_completion_tokens).toBeGreaterThanOrEqual(2048);
    expect(body.max_tokens).toBeUndefined();
  });

  it("retries once with the conservative shape when the provider rejects the modern one", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body?: string }) => {
        bodies.push(JSON.parse(String(init?.body ?? "{}")));
        call += 1;
        if (call === 1) return new Response("bad request", { status: 400 });
        return new Response(
          JSON.stringify({ model: "m", choices: [{ message: { content: "{}" } }] }),
          { status: 200 },
        );
      }),
    );

    const e = await enhanceAnalysis(baseResult(), RESUME, { apiKey: "test" });
    expect(bodies).toHaveLength(2);
    expect(bodies[0].response_format).toBeDefined(); // modern shape first
    expect(bodies[1].response_format).toBeUndefined(); // compat retry
    expect(bodies[1].max_tokens).toBeDefined();
    expect(e.enhanced).toBe(true);
  });

  it("salvages JSON wrapped in prose or a markdown fence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              model: "m",
              choices: [
                {
                  message: {
                    content:
                      'Sure! Here is the result:\n```json\n{"summary":"Ok.","recommendations":[],"secondOpinion":{"summary":"Fine.","strengths":[],"concerns":[],"verdict":"Strong"}}\n```',
                  },
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const e = await enhanceAnalysis(baseResult(), RESUME, { apiKey: "test" });
    expect(e.enhanced).toBe(true);
    expect(e.secondOpinion?.verdict).toBe("Strong");
  });

  it("surfaces the provider's error text when it rejects the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response('{"error":{"message":"model_not_found"}}', { status: 404 }),
      ),
    );
    const e = await enhanceAnalysis(baseResult(), RESUME, { apiKey: "test" });
    expect(e.enhanced).toBe(false);
    expect(e.reason).toBe("http");
    expect(e.status).toBe(404);
    expect(e.detail).toContain("model_not_found");
  });
});

describe("endpoint URL construction", () => {
  /** Capture the URL the app calls. */
  function captureUrl(): () => string {
    let url = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => {
        url = String(u);
        return new Response(
          JSON.stringify({ model: "m", choices: [{ message: { content: "{}" } }] }),
          { status: 200 },
        );
      }),
    );
    return () => url;
  }

  const cases: Array<[string | undefined, string]> = [
    // No base URL -> default OpenAI root, exactly one /v1.
    [undefined, "https://api.openai.com/v1/chat/completions"],
    ["https://api.openai.com/v1", "https://api.openai.com/v1/chat/completions"],
    ["https://api.openai.com/v1/", "https://api.openai.com/v1/chat/completions"],
    ["https://api.groq.com/openai", "https://api.groq.com/openai/v1/chat/completions"],
    ["https://api.groq.com/openai/v1", "https://api.groq.com/openai/v1/chat/completions"],
  ];

  for (const [base, expected] of cases) {
    it(`builds ${expected} from baseUrl=${base ?? "(unset)"}`, async () => {
      const getUrl = captureUrl();
      await enhanceAnalysis(baseResult(), RESUME, { apiKey: "test", baseUrl: base });
      const url = getUrl();
      expect(url).toBe(expected);
      expect(url).not.toMatch(/\/v1\/v1\//); // the doubled-version bug
    });
  }
});

describe("the request payload actually carries the bullets", () => {
  /** Capture the user message the app sends, parsed out of the request body. */
  function captureUserMessage(): () => string {
    let captured = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body?: string }) => {
        const body = JSON.parse(String(init?.body ?? "{}"));
        const msgs = (body.messages ?? []) as Array<{ role: string; content: string }>;
        captured = msgs.find((m) => m.role === "user")?.content ?? "";
        return new Response(
          JSON.stringify({ model: "m", choices: [{ message: { content: "{}" } }] }),
          { status: 200 },
        );
      }),
    );
    return () => captured;
  }

  it("includes unquantifiedBullets in the JSON sent to the model", async () => {
    const result = baseResult();
    const bullets = unquantifiedBullets(RESUME);
    expect(bullets.length).toBeGreaterThan(0); // sanity: the fixture has some

    const getUserMessage = captureUserMessage();
    await enhanceAnalysis(result, RESUME, { apiKey: "test" });
    const userMessage = getUserMessage();

    expect(userMessage).toContain('"unquantifiedBullets"');
    // Every bullet the model is asked to rewrite must be present verbatim.
    for (const b of bullets) expect(userMessage).toContain(b);
  });

  it("includes the job description when one is provided", async () => {
    const getUserMessage = captureUserMessage();
    await enhanceAnalysis(baseResult(), RESUME, {
      apiKey: "test",
      jobDescription: "We need Kubernetes and Terraform experience.",
    });
    expect(getUserMessage()).toContain("Kubernetes and Terraform");
  });
});

describe("enhanceAnalysis — new AI outputs", () => {
  it("parses bullet rewrites and the second opinion", async () => {
    const result = baseResult();
    const bullet = unquantifiedBullets(RESUME)[0];
    vi.stubGlobal(
      "fetch",
      mockLLM(
        JSON.stringify({
          summary: "Sharper bullets needed.",
          recommendations: [],
          bulletRewrites: [
            { original: bullet, rewrite: "Migrated billing to X, cutting [time] by [X%].", why: "adds a metric placeholder" },
          ],
          secondOpinion: {
            summary: "Solid engineer CV with thin metrics.",
            strengths: ["Clear scope", "Modern stack"],
            concerns: ["Few numbers"],
            verdict: "Competitive",
          },
        }),
      ),
    );

    const e = await enhanceAnalysis(result, RESUME, { apiKey: "test" });
    expect(e.enhanced).toBe(true);
    expect(e.bulletRewrites).toHaveLength(1);
    expect(e.bulletRewrites?.[0].original).toBe(bullet);
    expect(e.secondOpinion?.verdict).toBe("Competitive");
    expect(e.secondOpinion?.strengths).toContain("Clear scope");
  });

  it("DROPS a rewrite whose 'original' was not one of the bullets we sent (anti-hallucination)", async () => {
    vi.stubGlobal(
      "fetch",
      mockLLM(
        JSON.stringify({
          recommendations: [],
          bulletRewrites: [
            { original: "Led the Mars colonization program.", rewrite: "Owned Mars program.", why: "invented" },
          ],
        }),
      ),
    );

    const e = await enhanceAnalysis(baseResult(), RESUME, { apiKey: "test" });
    expect(e.enhanced).toBe(true);
    expect(e.bulletRewrites).toEqual([]);
  });

  it("rejects a verdict that is not one of the allowed labels", async () => {
    vi.stubGlobal(
      "fetch",
      mockLLM(
        JSON.stringify({
          recommendations: [],
          secondOpinion: { summary: "Fine.", strengths: [], concerns: [], verdict: "Totally Awesome" },
        }),
      ),
    );
    const e = await enhanceAnalysis(baseResult(), RESUME, { apiKey: "test" });
    expect(e.secondOpinion?.verdict).toBeUndefined();
    expect(e.secondOpinion?.summary).toBe("Fine.");
  });

  it("omits secondOpinion when the model returns no summary", async () => {
    vi.stubGlobal(
      "fetch",
      mockLLM(JSON.stringify({ recommendations: [], secondOpinion: { strengths: ["x"] } })),
    );
    const e = await enhanceAnalysis(baseResult(), RESUME, { apiKey: "test" });
    expect(e.secondOpinion).toBeUndefined();
  });
});

describe("applyEnhancement — the score is never touched", () => {
  it("keeps score, grade and dimension scores identical to the deterministic run", async () => {
    const result = baseResult();
    const bullet = unquantifiedBullets(RESUME)[0];
    vi.stubGlobal(
      "fetch",
      mockLLM(
        JSON.stringify({
          summary: "AI summary.",
          recommendations: [{ index: 0, title: "REWRITTEN", why: "w", fix: "f" }],
          bulletRewrites: [{ original: bullet, rewrite: "Rewritten bullet with [X%].", why: "why" }],
          secondOpinion: { summary: "Read.", strengths: ["a"], concerns: ["b"], verdict: "Strong" },
        }),
      ),
    );

    const e = await enhanceAnalysis(result, RESUME, { apiKey: "test" });
    const applied = applyEnhancement(result, e);

    // Deterministic numbers are untouched.
    expect(applied.score).toBe(result.score);
    expect(applied.grade).toBe(result.grade);
    expect(applied.dimensions.map((d) => d.score)).toEqual(result.dimensions.map((d) => d.score));
    // AI artifacts are attached.
    expect(applied.enhanced).toBe(true);
    expect(applied.bulletRewrites).toHaveLength(1);
    expect(applied.secondOpinion?.verdict).toBe("Strong");
  });

  it("does not attach AI sections when the enhancement is empty", () => {
    const result = baseResult();
    const applied = applyEnhancement(result, { enhanced: true });
    expect(applied.bulletRewrites).toBeUndefined();
    expect(applied.secondOpinion).toBeUndefined();
  });
});

describe("markdown report includes the AI sections", () => {
  it("writes rewritten bullets and the second opinion", () => {
    const result = baseResult();
    const withAi = {
      ...result,
      enhanced: true,
      enhancedModel: "mock-model-1",
      bulletRewrites: [{ original: "Worked on billing", rewrite: "Migrated billing, cutting [X%].", why: "metric" }],
      secondOpinion: { summary: "Good.", strengths: ["Scope"], concerns: ["Metrics"], verdict: "Competitive" },
    };
    const md = buildMarkdownReport(withAi);
    expect(md).toContain("## Rewritten bullets (AI)");
    expect(md).toContain("Migrated billing, cutting [X%].");
    expect(md).toContain("## Recruiter second opinion (AI) — Competitive");
    expect(md).toContain("does not change the score");
  });
});
