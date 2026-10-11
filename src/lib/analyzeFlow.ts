import type { AnalysisResult } from "@/lib/types";
import { extractTextFromFile, UnsupportedFileError, MAX_UPLOAD_BYTES } from "@/lib/parse/extract";
import { analyzeResume } from "@/lib/analyze/engine";
import { enhanceAnalysis, applyEnhancement } from "@/lib/analyze/llm";
import { aiWarning } from "@/lib/aiWarning";

/**
 * Shared request handling for the two-phase AI flow.
 *
 * Phase 1 (POST /api/analyze) — deterministic, instant:
 *   - extract + score the resume, NEVER blocking on the LLM.
 *   - if the user asked for AI and a key exists, mark `aiStatus: "pending"`
 *     and tell the client the token to use on the second call.
 *
 * Phase 2 (POST /api/ai) — async hydration:
 *   - the client calls back with `token` (the same text, verbatim), the job
 *     description, and the optional flag; we re-run the deterministic analysis
 *     to build an identical payload, call the provider, and return only the AI
 *     fields + warnings. The score is recomputed deterministically and is
 *     identical to phase 1.
 */

const MAX_TEXT_CHARS = 80_000;

/** Extract text + score deterministically, mirroring /api/analyze's rules. */
export async function runDeterministic(
  formData: FormData,
): Promise<
  | { ok: true; result: AnalysisResult; pages?: number }
  | { ok: false; status: number; error: string }
> {
  const file = formData.get("file");
  const pastedText = (formData.get("text") as string | null)?.trim() ?? "";
  const jobDescription = (formData.get("jobDescription") as string | null)?.trim() ?? "";

  if (jobDescription.length > 20_000) {
    return { ok: false, status: 413, error: "Job description is too long (limit 20,000 characters)." };
  }

  let text = pastedText;
  let pages: number | undefined;
  const warnings: string[] = [];

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return { ok: false, status: 413, error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
    }
    const buffer = await file.arrayBuffer();
    if (!magicBytesOk(file.name, buffer)) {
      return { ok: false, status: 415, error: `The file "${file.name}" does not look like a real ${file.name.split(".").pop()?.toUpperCase()} file. Please upload a genuine PDF/DOCX/TXT.` };
    }
    try {
      const outcome = await extractTextFromFile(file.name, buffer);
      const useFileText = !outcome.emptyExtraction || !pastedText;
      if (useFileText) {
        text = outcome.text;
        pages = outcome.pages;
        warnings.push(...outcome.warnings);
      }
    } catch (err) {
      if (err instanceof UnsupportedFileError) return { ok: false, status: 415, error: err.message };
      return { ok: false, status: 422, error: "Could not read that file. Try exporting a fresh PDF or pasting the text instead." };
    }
  }

  if (!text || text.trim().length < 40) {
    return { ok: false, status: 400, error: "Not enough text to analyze. Upload a text-based PDF/DOCX or paste at least a few lines of your resume." };
  }

  text = text.slice(0, MAX_TEXT_CHARS);
  const result = analyzeResume(text, { jobDescription }, { pages, warnings });
  // Echo the analyzed text back so users can verify extraction handled their
  // resume correctly (and catch scanned-PDF / mangling cases).
  result.extractedText = text;
  return { ok: true, result, pages };
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
  return true; // txt/md/text and unknown ext are handled downstream
}

/** Run the AI enhancement against an already-scored result. */
export async function runEnhancement(
  result: AnalysisResult,
  text: string,
  jobDescription: string,
): Promise<{ result: AnalysisResult; warnings: string[] }> {
  const warnings: string[] = [];
  const enhancement = await enhanceAnalysis(result, text, { jobDescription });
  if (enhancement.enhanced) {
    return { result: applyEnhancement(result, enhancement), warnings };
  }
  warnings.push(aiWarning(enhancement));
  console.error(
    JSON.stringify({
      event: "ai_enhance_failed",
      reason: enhancement.reason ?? "unknown",
      status: enhancement.status,
      detail: enhancement.detail,
      model: process.env.OPENAI_MODEL,
    }),
  );
  return { result, warnings };
}