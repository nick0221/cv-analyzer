import { getDocumentProxy, extractText } from "unpdf";

/** Number of form feeds / explicit page breaks seen during extraction. */
export interface PdfExtractResult {
  text: string;
  pages: number;
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<PdfExtractResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n\n") : text;
  return { text: normalizeExtracted(merged), pages: totalPages ?? 0 };
}

/**
 * PDF extractors emit hard-wrapped lines and stray non-breaking spaces.
 * Collapse the noise that would otherwise poison every downstream rule.
 */
export function normalizeExtracted(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
