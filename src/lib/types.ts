export type Priority = "high" | "medium" | "low";

export type DimensionKey =
  | "structure"
  | "impact"
  | "verbs"
  | "length"
  | "ats"
  | "language"
  | "experience"
  | "skills"
  | "professionalism"
  | "contact";

export interface Recommendation {
  priority: Priority;
  dimension: DimensionKey;
  title: string;
  why: string;
  fix: string;
}

export interface DimensionResult {
  key: DimensionKey;
  label: string;
  /** 0-100 */
  score: number;
  /**
   * Relative weight used in the total score, 0-1.
   * Optional because rules no longer set it; the engine assigns weights.
   */
  weight?: number;
  summary: string;
  findings: string[];
  recommendations: Recommendation[];
}

export interface MatchResult {
  provided: boolean;
  /** 0-100 */
  score: number;
  keywordsFound: string[];
  keywordsMissing: string[];
  /** Terms the JD marks as required (must/essential/need) that are missing. */
  mustHaveMissing: string[];
  /** Required terms that are present. */
  mustHaveFound: string[];
  /** Missing-but-actually-present keywords that sit deep/late in the resume. */
  buriedKeywords: string[];
  recommendations: Recommendation[];
}

export interface AnalysisResult {
  score: number;
  grade: string;
  wordCount: number;
  bulletCount: number;
  estimatedPages: number;
  dimensions: DimensionResult[];
  /** Flattened, deduped, priority-sorted list across all dimensions. */
  recommendations: Recommendation[];
  match: MatchResult;
  warnings: string[];
  /**
   * The text the analysis actually ran on, echoed back so the user can verify
   * extraction picked up their real resume (catch scanned-PDF / mangling cases).
   * Optional: the LLM enhancement path and older clients may omit it.
   */
  extractedText?: string;
  /** Present only when the optional LLM enhancement ran. */
  enhanced?: boolean;
  enhancedModel?: string;
  enhancedSummary?: string;
}

export interface AnalyzeRequest {
  /** Plain text resume. Used directly when no file is uploaded. */
  text?: string;
  /** Optional target job description for keyword matching. */
  jobDescription?: string;
}
