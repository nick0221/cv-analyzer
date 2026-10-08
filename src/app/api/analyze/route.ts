import { NextRequest, NextResponse } from "next/server";
import { extractTextFromFile, UnsupportedFileError, MAX_UPLOAD_BYTES } from "@/lib/parse/extract";
import { analyzeResume } from "@/lib/analyze/engine";

// Give large PDFs room to parse on Vercel. (Node runtime is the default.)
export const maxDuration = 30;

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
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

  let text = pastedText;
  let pages: number | undefined;
  const warnings: string[] = [];

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return badRequest(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`, 413);
    }
    try {
      const outcome = await extractTextFromFile(file.name, await file.arrayBuffer());
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

  const result = analyzeResume(text, { jobDescription }, { pages, warnings });
  return NextResponse.json(result);
}
