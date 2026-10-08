export type Priority = "high" | "medium" | "low";

export type DimensionKey =
  | "structure"
  | "impact"
  | "verbs"
  | "length"
  | "ats"
  | "language";

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
  /** Relative weight used in the total score, 0-1. */
  weight: number;
  summary: string;
  findings: string[];
  recommendations: Recommendation[];
}

export interface MatchResult {
  provided: boolean;
  /** 0-100, 0 when no job description was supplied. */
  score: number;
  keywordsFound: string[];
  keywordsMissing: string[];
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
}

export interface AnalyzeRequest {
  /** Plain text resume. Used directly when no file is uploaded. */
  text?: string;
  /** Optional target job description for keyword matching. */
  jobDescription?: string;
}
