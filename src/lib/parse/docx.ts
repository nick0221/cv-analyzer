import mammoth from "mammoth";
import { normalizeExtracted } from "./pdf";

export interface DocxExtractResult {
  text: string;
  /** Messages from the converter (e.g. skipped images) worth surfacing. */
  messages: string[];
}

export async function extractDocxText(buffer: ArrayBuffer): Promise<DocxExtractResult> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return {
    text: normalizeExtracted(result.value),
    messages: result.messages.map((m) => m.message),
  };
}
