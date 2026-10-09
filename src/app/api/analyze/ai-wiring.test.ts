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

describe("AI enhancement wiring in the route", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("calls the LLM and marks the result enhanced when aiEnhance=1", async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          model: "mock-model",
          choices: [{ message: { content: JSON.stringify({ summary: "S", recommendations: [] }) } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    const res = await POST(req({ text: RESUME, aiEnhance: "1" }, "9.9.9.1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(body.enhanced).toBe(true);
    expect(body.enhancedModel).toBe("mock-model");
  });

  it("does NOT call the LLM when aiEnhance is absent (default)", async () => {
    const mockFetch = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    const res = await POST(req({ text: RESUME }, "9.9.9.2"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(body.enhanced).toBeFalsy();
  });

  it("stays 200 with a specific warning when aiEnhance=1 but the LLM fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 502 })));
    const res = await POST(req({ text: RESUME, aiEnhance: "1" }, "9.9.9.2"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enhanced).toBeFalsy();
    // The warning must name the failure, not collapse to a generic "unavailable".
    expect(body.warnings.join(" ")).toMatch(/HTTP 502/);
    expect(body.warnings.join(" ")).toMatch(/standard analysis/i);
  });

  it("reports a network failure distinctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const res = await POST(req({ text: RESUME, aiEnhance: "1" }, "9.9.9.3"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.warnings.join(" ")).toMatch(/could not be reached/i);
  });
});
