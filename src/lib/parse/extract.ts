import { extractPdfText } from "./pdf";
import { extractDocxText } from "./docx";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export interface ExtractOutcome {
  text: string;
  /** Page count when known (PDF). */
  pages?: number;
  warnings: string[];
  /** True when the file produced (almost) no text - usually a scanned PDF. */
  emptyExtraction: boolean;
}

export class UnsupportedFileError extends Error {}

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx + 1).toLowerCase();
}

export async function extractTextFromFile(
  filename: string,
  buffer: ArrayBuffer,
): Promise<ExtractOutcome> {
  const ext = extensionOf(filename);
  const warnings: string[] = [];

  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new UnsupportedFileError(
      `File is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB. The limit is ${
        MAX_UPLOAD_BYTES / 1024 / 1024
      } MB - export a leaner PDF or paste the text instead.`,
    );
  }

  let text = "";
  let pages: number | undefined;

  if (ext === "pdf") {
    const res = await extractPdfText(buffer);
    text = res.text;
    pages = res.pages;
  } else if (ext === "docx") {
    const res = await extractDocxText(buffer);
    text = res.text;
    warnings.push(...res.messages);
  } else if (ext === "txt" || ext === "md" || ext === "text") {
    text = new TextDecoder("utf-8").decode(buffer);
  } else {
    throw new UnsupportedFileError(
      `Unsupported file type ".${ext || "unknown"}". Upload a PDF, DOCX or TXT file.`,
    );
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const emptyExtraction = wordCount < 40;
  if (emptyExtraction) {
    warnings.push(
      "Almost no text could be read from this file. If it is a scanned or image-only PDF, paste the resume text directly instead.",
    );
  }

  return { text, pages, warnings, emptyExtraction };
}
