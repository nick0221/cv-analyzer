import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { resetRateLimits } from "@/lib/rateLimit";
import { NextRequest } from "next/server";

const RESUME =
  "Jane Doe — Senior Software Engineer. Led a team of 6 engineers and increased conversion 23%. " +
  "Built React and Next.js applications, reduced page load time by 45%. Skills: TypeScript, Next.js, AWS, Docker. " +
  "Experience 2020 - 2023. Education: BSc Computer Science. Summary of achievements and responsibilities.";

function req(fields: Record<string, string>, ip = "9.9.9.9") {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = new NextRequest("http://localhost/api/ai", { method: "POST", body: fd, headers: { "x-forwarded-for": ip } });
  r.cookies.set({ name: "cv-consent", value: "accepted" });
  return r;
}

describe("POST /api/ai (async hydration)", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("calls the provider and returns only the AI fields", async () => {
    // A resume with a real unquantified bullet so the engine asks for a rewrite.
    const AI_RESUME =
      "Jane Doe\nExperience\n- Worked on the billing migration project.\n- Helped with onboarding new hires.\nSkills: TypeScript, React, AWS\nEducation: BSc Computer Science 2018";
    const content = JSON.stringify({
      summary: "AI summary.",
      recommendations: [{ index: 0, title: "AI title", why: "w", fix: "f" }],
      bulletRewrites: [
        { original: "Worked on the billing migration project.", rewrite: "Delivered X with [Y%].", why: "metric" },
      ],
      secondOpinion: { summary: "Solid.", strengths: ["scope"], concerns: ["metrics"], verdict: "Your resume has potential but needs more metrics." },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ model: "mock", choices: [{ message: { content } }] }), { status: 200 }),
      ),
    );

    const res = await POST(req({ text: AI_RESUME }, "9.9.9.1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enhanced).toBe(true);
    expect(body.secondOpinion?.verdict).toBe("Needs work"); // free-form mapped
    expect(body.bulletRewrites).toHaveLength(1);
    // The deterministic fields must NOT be re-sent.
    expect(body.score).toBeUndefined();
    expect(body.dimensions).toBeUndefined();
  });

  it("returns 503 (not a crash) when no provider is configured", async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const res = await POST(req({ text: RESUME }, "9.9.9.2"));
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toMatch(/not configured/i);
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
    }
  });

  it("enforces consent", async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const fd = new FormData();
      fd.append("text", RESUME);
      const r = new NextRequest("http://localhost/api/ai", { method: "POST", body: fd });
      // no consent cookie
      const res = await POST(r);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/consent/i);
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
    }
  });

  it("propagates a provider failure as a warning, not a 500", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 502 })));
    const res = await POST(req({ text: RESUME }, "9.9.9.3"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enhanced).toBe(false);
    expect(body.warnings.join(" ")).toMatch(/HTTP 502/);
    expect(body.score).toBeUndefined();
  });
});