import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { resetRateLimits } from "@/lib/rateLimit";
import { NextRequest } from "next/server";

const CONSENT = { name: "cv-consent", value: "accepted" };

function makeReq(opts: {
  fields?: Record<string, string | { name: string; bytes: Uint8Array }>;
  consent?: boolean;
  ip?: string;
}): NextRequest {
  const fd = new FormData();
  for (const [k, v] of Object.entries(opts.fields ?? {})) {
    if (typeof v === "string") fd.append(k, v);
    else fd.append(k, new File([v.bytes as BlobPart], v.name));
  }
  const req = new NextRequest("http://localhost/api/analyze", {
    method: "POST",
    body: fd,
    headers: { "x-forwarded-for": opts.ip ?? "1.2.3.4" },
  });
  if (opts.consent !== false) req.cookies.set(CONSENT);
  return req;
}

const LONG_RESUME =
  "Jane Doe — Senior Software Engineer. Led a team of 6 engineers and increased conversion 23%. " +
  "Built React and Next.js applications, reduced page load time by 45%. Skills: TypeScript, Next.js, AWS, Docker. " +
  "Experience 2020 - 2023. Education: BSc Computer Science. Summary of achievements and responsibilities.";

describe("POST /api/analyze", () => {
  beforeEach(() => resetRateLimits());

  it("returns 403 without consent", async () => {
    const res = await POST(makeReq({ fields: { text: LONG_RESUME }, consent: false }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/accept|consent/i);
  });

  it("returns 200 with a valid pasted resume + consent", async () => {
    const res = await POST(makeReq({ fields: { text: LONG_RESUME } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBeGreaterThan(0);
    expect(Array.isArray(body.dimensions)).toBe(true);
  });

  it("returns 400 when the text is too short", async () => {
    const res = await POST(makeReq({ fields: { text: "too short" } }));
    expect(res.status).toBe(400);
  });

  it("returns 413 for a job description that is too long", async () => {
    const res = await POST(makeReq({ fields: { text: LONG_RESUME, jobDescription: "x".repeat(20001) } }));
    expect(res.status).toBe(413);
  });

  it("returns 415 when a .pdf is not actually a PDF (magic bytes)", async () => {
    const fakePdf = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x01, 0x02, 0x03, 0x04]); // MZ header
    const res = await POST(makeReq({ fields: { file: { name: "virus.pdf", bytes: fakePdf } } }));
    expect(res.status).toBe(415);
  });

  it("returns 429 after the per-IP limit is exceeded", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const res = await POST(makeReq({ fields: { text: LONG_RESUME } }));
      last = res.status;
    }
    expect(last).toBe(429);
  });

  it("sets Cache-Control: no-store", async () => {
    const res = await POST(makeReq({ fields: { text: LONG_RESUME } }));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
