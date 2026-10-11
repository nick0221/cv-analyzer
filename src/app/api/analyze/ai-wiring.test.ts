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
  const r = new NextRequest("http://localhost/api/analyze", { method: "POST", body: fd, headers: { "x-forwarded-for": ip } });
  r.cookies.set({ name: "cv-consent", value: "accepted" });
  return r;
}

describe("AI enhancement wiring in the route (streaming)", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is INSTANT: never calls the LLM inline; marks aiStatus pending when opted in", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await POST(req({ text: RESUME, aiEnhance: "1" }, "9.9.9.1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(mockFetch).not.toHaveBeenCalled(); // the slow provider call is NOT here
    expect(body.score).toBeGreaterThan(0);
    expect(body.aiStatus).toBe("pending");
    expect(body.enhanced).toBeFalsy(); // hydration happens on /api/ai
  });

  it("does NOT call the LLM when aiEnhance is absent (default)", async () => {
    const mockFetch = vi.fn(async () => new Response("{}\n", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    const res = await POST(req({ text: RESUME }, "9.9.9.2"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(body.enhanced).toBeFalsy();
    expect(body.aiStatus).toBeUndefined();
  });

  it("says plainly when AI was requested but the deployment has no key", async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const res = await POST(req({ text: RESUME, aiEnhance: "1" }, "9.9.9.4"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.enhanced).toBeFalsy();
      expect(body.aiStatus).toBeUndefined();
      expect(body.warnings.join(" ")).toMatch(/not configured/i);
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
    }
  });

  it("still returns the deterministic score even when the AI endpoint would be slow", async () => {
    // Simulate a hypothetical slow provider by asserting we never even reach it.
    vi.stubGlobal("fetch", vi.fn());
    const res = await POST(req({ text: RESUME, aiEnhance: "1" }, "9.9.9.7"));
    const body = await res.json();
    expect(body.score).toBeGreaterThan(0);
    expect(body.dimensions.length).toBeGreaterThan(0);
    expect(body.recommendations.length).toBeGreaterThan(0);
  });
});

describe("aiWarning shared helper", () => {
  it("is exported and maps reasons", async () => {
    const { aiWarning } = await import("@/lib/aiWarning");
    expect(aiWarning({ reason: "timeout" })).toMatch(/too long to respond/i);
    expect(aiWarning({ reason: "http", status: 429 })).toMatch(/credits or quota/i);
    expect(aiWarning({ reason: "http", status: 401 })).toMatch(/key was rejected/i);
  });
});