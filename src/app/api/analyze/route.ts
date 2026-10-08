import { NextRequest, NextResponse } from "next/server";
import { extractTextFromFile, UnsupportedFileError, MAX_UPLOAD_BYTES } from "@/lib/parse/extract";
import { analyzeResume } from "@/lib/analyze/engine";
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

/** First bytes: %PDF => PDF, PK\x03\x04 => ZIP (docx), else plain text. */
function sniffKind(buf: ArrayBuffer): "pdf" | "zip" | "text" {
  const b = new Uint8Array(buf.slice(0, 4));
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "zip";
  return "text";
}

/** Reject a file whose bytes clearly do not match its extension. */
function magicBytesOk(filename: string, buf: ArrayBuffer): boolean {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  const kind = sniffKind(buf);
  if (ext === "pdf") return kind === "pdf";
  if (ext === "docx") return kind === "zip";
  if (ext === "txt" || ext === "md" || ext === "text") return true; // any bytes decode as text
  return true; // unknown ext is handled downstream by extractTextFromFile
}

export async function POST(req: NextRequest) {
  // Rate limit first: cheap, and protects the expensive parsing below.
  const rl = checkRateLimit(clientKey(req));
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

  const file = formData.get("file");
  const pastedText = (formData.get("text") as string | null)?.trim() ?? "";
  const jobDescription = (formData.get("jobDescription") as string | null)?.trim() ?? "";

  if (jobDescription.length > 20_000) {
    return badRequest("Job description is too long (limit 20,000 characters).", 413);
  }

  let text = pastedText;
  let pages: number | undefined;
  const warnings: string[] = [];

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return badRequest(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`, 413);
    }
    const buffer = await file.arrayBuffer();
    if (!magicBytesOk(file.name, buffer)) {
      return badRequest(
        `The file "${file.name}" does not look like a real ${file.name.split(".").pop()?.toUpperCase()} file. Please upload a genuine PDF/DOCX/TXT.`,
        415,
      );
    }
    try {
      const outcome = await extractTextFromFile(file.name, buffer);
      // A pasted resume wins only if the file yielded nothing usable.
      const useFileText = !outcome.emptyExtraction || !pastedText;
      if (useFileText) {
        text = outcome.text;
        pages = outcome.pages;
        warnings.push(...outcome.warnings);
      }
    } catch (err) {
      if (err instanceof UnsupportedFileError) return badRequest(err.message, 415);
      console.error("extraction failed", err);
      return badRequest("Could not read that file. Try exporting a fresh PDF or pasting the text instead.", 422);
    }
  }

  if (!text || text.trim().length < 40) {
    return badRequest(
      "Not enough text to analyze. Upload a text-based PDF/DOCX or paste at least a few lines of your resume.",
    );
  }

  const started = Date.now();
  const result = analyzeResume(text, { jobDescription }, { pages, warnings });
  // Structured log line — cheap observability without a vendor.
  console.log(
    JSON.stringify({
      event: "analyze",
      ms: Date.now() - started,
      words: result.wordCount,
      score: result.score,
      dimensions: result.dimensions.length,
      recs: result.recommendations.length,
      rateRemaining: rl.remaining,
    }),
  );
  return json(result);
}
