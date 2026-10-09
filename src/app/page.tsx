"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { track } from "@vercel/analytics";
import type { AnalysisResult } from "@/lib/types";
import { ScoreGauge } from "@/components/ScoreGauge";
import { DimensionBar } from "@/components/DimensionBar";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ConsentBanner } from "@/components/ConsentBanner";
import {
  getConsentSnapshot,
  getConsentServerSnapshot,
  setConsent,
  clearConsent,
  subscribeConsent,
} from "@/lib/consent";

const MAX_BYTES = 10 * 1024 * 1024;

const KBD = "font-mono text-[11px] text-[#808080]";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // Tracks whether the last result came from a file (extracted text) so the
  // "what we read" panel only appears when it is meaningful.
  const [source, setSource] = useState<"file" | "paste" | null>(null);
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getConsentServerSnapshot,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  // When a fresh result arrives, bring it into view (the results mount below
  // the fold). Honour prefers-reduced-motion and never steal focus on mobile.
  useEffect(() => {
    if (!result || !resultsRef.current) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }, [result]);

  function onConsentToggle(checked: boolean) {
    if (checked) {
      setConsent();
      setBannerDismissed(true);
    } else {
      clearConsent();
    }
  }

  function acceptFromBanner() {
    setConsent();
    setBannerDismissed(true);
  }

  const onPick = useCallback((f: File | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError(`That file is ${(f.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`);
      return;
    }
    setError(null);
    setFile(f);
    setMode("file");
    track("resume_uploaded", { kind: f.name.split(".").pop()?.toLowerCase() ?? "unknown" });
  }, []);

  async function analyze() {
    setError(null);
    if (!file && text.trim().length < 40) {
      setError("Upload a PDF/DOCX or paste at least a few lines of your resume.");
      return;
    }
    if (!consent) {
      setError("Please tick the consent box confirming your CV may be analyzed.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      if (text.trim()) fd.append("text", text);
      if (jobDescription.trim()) fd.append("jobDescription", jobDescription);
      if (useAI) fd.append("aiEnhance", "1");
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong analyzing the resume.");
        track("resume_analyze_failed", { status: res.status });
        return;
      }
      const parsed = data as AnalysisResult;
      setResult(parsed);
      setSource(file ? "file" : "paste");
      setLoading(false);
      track("resume_analyzed", {
        score: Math.round(parsed.score),
        grade: parsed.grade,
        source: file ? "file" : "text",
        withJd: Boolean(jobDescription.trim()),
      });
    } catch {
      setError("Network error - please try again.");
      track("resume_analyze_failed", { status: 0 });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setText("");
    setJobDescription("");
    setResult(null);
    setError(null);
    setSource(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  /** One-click demo: load a sample resume so a first-time visitor can see the
   * product work without hunting for a file. */
  async function loadSample() {
    setError(null);
    setResult(null);
    setMode("paste");
    try {
      const res = await fetch("/sample-resume.txt");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setText(await res.text());
      setFile(null);
    } catch {
      setError("Couldn't load the sample resume right now — try again in a moment.");
    }
  }

  const hasInput = Boolean(file || text.trim());

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pb-24 pt-10 sm:px-8">
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between" data-print="hide">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[#171717] font-mono text-[12px] font-medium text-white">
            CV
          </span>
          <span className="text-[15px] font-medium tracking-[-0.32px] text-[#171717]">
            cv-analyzer
          </span>
        </div>
        <span className={`${KBD} hidden sm:block`}>
          server-side · nothing stored
        </span>
      </header>

      <section className="mt-16 max-w-2xl">
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[#808080]">
          resume quality analyzer
        </p>
        <h1 className="mt-3 text-[44px] font-semibold leading-[1.05] tracking-[-2.4px] text-[#171717]">
          Get a score. Get the fixes.
        </h1>
        <p className="mt-4 max-w-[560px] text-[17px] leading-relaxed text-[#4d4d4d]">
          Upload or paste a resume and the analyzer scores it across 10 dimensions, then tells
          you exactly what to change and how.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex h-6 items-center gap-1.5 rounded-full bg-[#f0f4ff] px-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0a5fd0]" />
            <span className="font-mono text-[11px] font-medium text-[#0a5fd0]">10 dimensions</span>
          </div>
          <div className="flex h-6 items-center gap-1.5 rounded-full bg-[#f5fbf7] px-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#067647]" />
            <span className="font-mono text-[11px] font-medium text-[#067647]">0 data stored</span>
          </div>
          <button
            onClick={loadSample}
            data-print="hide"
            className="rounded-full border border-[#e2e2e2] bg-white px-3 py-1 font-mono text-[11px] font-medium text-[#4d4d4d] transition-colors hover:border-[#b0b0b0] hover:text-[#171717]"
          >
            Try a sample resume →
          </button>
        </div>
      </section>

      {/* ── Workbench ────────────────────────────────────────────────────── */}
      <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_360px]" data-print="hide">
        {/* Left column: input */}
        <div className="space-y-4">
          <div className="rounded-lg bg-white p-5 shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px,rgba(0,0,0,0.04)_0px_8px_8px_-8px,#fafafa_0px_0px_0px_1px]">
            {/* Mode switch */}
            <div className="flex w-fit items-center gap-1 rounded-md bg-[#f5f5f5] p-1">
              {(["file", "paste"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    mode === m
                      ? "bg-white text-[#171717] shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px]"
                      : "text-[#808080] hover:text-[#171717]"
                  }`}
                >
                  {m === "file" ? "Upload file" : "Paste text"}
                </button>
              ))}
            </div>

            {mode === "file" ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  onPick(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors ${
                  dragging ? "border-[#0072f5] bg-[#f0f4ff]" : "border-[#d4d4d4] hover:border-[#b0b0b0]"
                }`}
              >
                <input
                  id="resume-file"
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="sr-only"
                  aria-describedby="resume-file-hint"
                  onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <div className="text-center">
                    <p className="font-mono text-[13px] font-medium text-[#171717]">
                      {file.name}
                    </p>
                    <p className="mt-1 font-mono text-[12px] text-[#808080]">
                      {(file.size / 1024).toFixed(0)} KB
                    </p>
                    <label
                      htmlFor="resume-file"
                      className="mt-3 inline-block cursor-pointer rounded-md border border-[#e2e2e2] px-3 py-1.5 text-[13px] font-medium text-[#4d4d4d] transition-colors hover:border-[#b0b0b0] hover:text-[#171717]"
                    >
                      Replace file
                    </label>
                  </div>
                ) : (
                  <>
                    <label
                      htmlFor="resume-file"
                      className="cursor-pointer rounded-md bg-[#171717] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-black"
                    >
                      Choose a file
                    </label>
                    <p className="mt-3 text-[13px] text-[#808080]">or drag it here</p>
                    <p id="resume-file-hint" className="mt-1 font-mono text-[11px] text-[#b0b0b0]">
                      PDF · DOCX · TXT — max 10 MB
                    </p>
                  </>
                )}
              </div>
            ) : (
              <textarea
                id="resume-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                placeholder={"Paste your resume text here…\n\nTip: use this for scanned PDFs that can't be read directly."}
                className="mt-4 w-full resize-y rounded-lg border border-[#e2e2e2] bg-white px-3.5 py-3 font-mono text-[13px] leading-relaxed text-[#171717] placeholder:text-[#b0b0b0] focus:border-[#0072f5] focus:outline-none focus:ring-2 focus:ring-[#c7dafe]"
              />
            )}

            {/* Job description */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label htmlFor="job-description" className="text-[13px] font-medium text-[#171717]">
                  Target job description
                </label>
                <span className="font-mono text-[11px] text-[#b0b0b0]">optional</span>
              </div>
              <textarea
                id="job-description"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={3}
                placeholder="Paste the job posting to see which keywords your resume is missing."
                className="mt-2 w-full resize-y rounded-lg border border-[#e2e2e2] bg-white px-3.5 py-3 font-mono text-[13px] leading-relaxed text-[#171717] placeholder:text-[#b0b0b0] focus:border-[#0072f5] focus:outline-none focus:ring-2 focus:ring-[#c7dafe]"
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-[#f4c7c3] bg-[#fef3f2] px-3.5 py-2.5 text-[13px] font-medium text-[#b42318]"
            >
              {error}
            </p>
          )}

          {/* Consent + AI toggles */}
          <div className="space-y-2.5">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#ebebeb] bg-white p-3.5 transition-colors hover:border-[#d4d4d4]">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => onConsentToggle(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#0072f5]"
              />
              <span className="text-[13px] leading-relaxed text-[#4d4d4d]">
                I agree that my resume/CV content will be sent to and analyzed by this app to produce
                a quality score and recommendations. It is processed for this purpose only and not
                stored.
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#ebebeb] bg-white p-3.5 transition-colors hover:border-[#d4d4d4]">
              <input
                type="checkbox"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#0072f5]"
              />
              <span className="text-[13px] leading-relaxed text-[#4d4d4d]">
                <span className="font-medium text-[#171717]">Improve wording with AI</span>{" "}
                <span className="font-mono text-[11px] text-[#b0b0b0]">optional</span> — sends the
                resume text and findings to a third-party LLM to rewrite the feedback more
                specifically. Leave off to keep everything on this server; the score is identical
                either way.
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={analyze}
              disabled={loading || !consent}
              className="rounded-md bg-[#171717] px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Analyzing…" : "Analyze resume"}
            </button>
            {hasInput && (
              <button
                onClick={reset}
                className="text-[13px] font-medium text-[#808080] transition-colors hover:text-[#171717]"
              >
                Reset
              </button>
            )}
            {loading && (
              <span className="font-mono text-[12px] text-[#b0b0b0]">
                parsing → scoring → ranking…
              </span>
            )}
          </div>
        </div>

        {/* Right column: rubric card */}
        <aside className="h-fit rounded-lg border border-[#ebebeb] bg-white p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-medium tracking-[-0.32px] text-[#171717]">What&apos;s scored</h2>
            <span className="font-mono text-[11px] text-[#b0b0b0]">10 dims</span>
          </div>
          <ul className="mt-4 space-y-3">
            {RUBRIC.map((r) => (
              <li key={r.label} className="flex items-center gap-3">
                <span className={`w-8 shrink-0 text-right font-mono text-[12px] tabular-nums ${r.hot ? "font-medium text-[#171717]" : "text-[#b0b0b0]"}`}>
                  {r.weight}%
                </span>
                <span className="h-1 flex-1 rounded-full bg-[#f0f0f0]">
                  <span className="block h-full rounded-full bg-[#d4d4d4]" style={{ width: `${r.weight}%` }} />
                </span>
                <span className="w-36 shrink-0 text-[13px] text-[#4d4d4d]">{r.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-[#f0f0f0] pt-3 font-mono text-[11px] leading-relaxed text-[#b0b0b0]">
            Weights are the actual scoring engine — impact and structure carry the most.
          </p>
        </aside>
      </section>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {result && (
        <section
          ref={resultsRef}
          className="mt-16 scroll-mt-6 space-y-8"
          aria-live="polite"
          aria-label="Analysis results"
        >
          <p className="sr-only">
            Analysis complete. Score {result.score} out of 100, grade {result.grade}.{" "}
            {result.recommendations.length} recommendation
            {result.recommendations.length === 1 ? "" : "s"}.
          </p>

          {result.warnings.length > 0 && (
            <div className="space-y-1 rounded-lg border border-[#f2ddc0] bg-[#fff8ed] p-4">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-[13px] text-[#b54708]">
                  <span className="font-mono">⚠</span> {w}
                </p>
              ))}
            </div>
          )}

          {/* Header: gauge + headline stats */}
          <div className="flex flex-col items-center gap-6 rounded-lg bg-white p-6 shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px,rgba(0,0,0,0.04)_0px_8px_8px_-8px,#fafafa_0px_0px_0px_1px] sm:flex-row sm:items-center">
            <ScoreGauge score={result.score} grade={result.grade} />
            <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Stat label="Words" value={result.wordCount.toLocaleString()} />
              <Stat label="Bullets" value={result.bulletCount} />
              <Stat label="Est. pages" value={result.estimatedPages} />
              <Stat label="Dimensions" value={result.dimensions.length} />
              <Stat label="Fixes" value={result.recommendations.length} />
              {result.match.provided && <Stat label="JD match" value={`${result.match.score}%`} />}
            </div>
          </div>

          {/* What we read — extracted text echo (file uploads only) */}
          {source === "file" && result.extractedText && (
            <details className="group rounded-lg border border-[#ebebeb] bg-white p-5">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
                <span className="text-[20px] font-semibold tracking-[-0.96px] text-[#171717]">
                  What we read
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#b0b0b0]">
                  {result.extractedText.split(/\s+/).filter(Boolean).length} words ·{" "}
                  <span className="inline-block transition-transform group-open:rotate-90">▸</span>
                </span>
              </summary>
              <p className="mt-3 border-t border-[#f0f0f0] pt-3 text-[13px] leading-relaxed text-[#808080]">
                This is the text the analyzer extracted from your file. If it looks wrong or
                missing parts of your resume (common with scanned PDFs), paste the text instead.
              </p>
              <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-[#f0f0f0] bg-[#fafafa] p-3.5 font-mono text-[12.5px] leading-relaxed text-[#4d4d4d]">
                {result.extractedText}
              </pre>
            </details>
          )}

          {result.enhanced && (
            <p className="rounded-md border border-[#e6d5f2] bg-[#fbf5ff] px-3.5 py-2.5 text-[13px] text-[#7a3cae]">
              Feedback wording improved by AI
              {result.enhancedModel ? (
                <span className="font-mono text-[11px]"> ({result.enhancedModel})</span>
              ) : null}
              {result.enhancedSummary ? ` — ${result.enhancedSummary}` : ""}
            </p>
          )}

          {/* Score breakdown */}
          <div>
            <h2 className="mb-3 flex items-baseline justify-between">
              <span className="text-[20px] font-semibold tracking-[-0.96px] text-[#171717]">Score breakdown</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#b0b0b0]">by dimension</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.dimensions.map((d) => (
                <DimensionBar
                  key={d.key}
                  label={d.label}
                  score={d.score}
                  summary={d.summary}
                  findings={d.findings}
                />
              ))}
            </div>
          </div>

          {/* JD match */}
          {result.match.provided && (
            <div className="rounded-lg bg-white p-5 shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px,rgba(0,0,0,0.04)_0px_8px_8px_-8px,#fafafa_0px_0px_0px_1px]">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[20px] font-semibold tracking-[-0.96px] text-[#171717]">
                  Job description match
                </h2>
                <span className="font-mono text-[20px] font-semibold tabular-nums text-[#171717]">
                  {result.match.score}%
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {result.match.mustHaveMissing.length > 0 && (
                  <p className="text-[13px] leading-relaxed text-[#4d4d4d]">
                    <span className="font-medium text-[#b42318]">Required but missing ({result.match.mustHaveMissing.length})</span>
                    <span className="mt-0.5 block font-mono text-[12.5px] text-[#b42318]">
                      {result.match.mustHaveMissing.join(", ")}
                    </span>
                  </p>
                )}
                <p className="text-[13px] leading-relaxed text-[#4d4d4d]">
                  <span className="font-medium text-[#067647]">Matched ({result.match.keywordsFound.length})</span>
                  <span className="mt-0.5 block font-mono text-[12.5px] text-[#067647]">
                    {result.match.keywordsFound.join(", ") || "—"}
                  </span>
                </p>
                <p className="text-[13px] leading-relaxed text-[#4d4d4d]">
                  <span className="font-medium text-[#808080]">Missing ({result.match.keywordsMissing.length})</span>
                  <span className="mt-0.5 block font-mono text-[12.5px] text-[#808080]">
                    {result.match.keywordsMissing.join(", ") || "—"}
                  </span>
                </p>
                {result.match.buriedKeywords.length > 0 && (
                  <p className="text-[13px] leading-relaxed text-[#4d4d4d]">
                    <span className="font-medium text-[#b54708]">Buried after Experience ({result.match.buriedKeywords.length})</span>
                    <span className="mt-0.5 block font-mono text-[12.5px] text-[#b54708]">
                      {result.match.buriedKeywords.join(", ")}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div>
            <h2 className="mb-3 flex items-baseline justify-between">
              <span className="text-[20px] font-semibold tracking-[-0.96px] text-[#171717]">Recommendations</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#b0b0b0]">
                {result.recommendations.length} fix{result.recommendations.length === 1 ? "" : "es"}
              </span>
            </h2>
            {result.recommendations.length === 0 ? (
              <p className="rounded-lg border border-[#ebebeb] bg-white p-5 text-[14px] text-[#4d4d4d]">
                No issues found — the resume looks solid.
              </p>
            ) : (
              <div className="space-y-3">
                {result.recommendations.map((rec, i) => (
                  <RecommendationCard key={i} rec={rec} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="mt-20 border-t border-[#ebebeb] pt-6 text-[13px] leading-relaxed text-[#808080]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            Analysis runs on the server and is not stored. Recommendations are heuristic — always
            use your own judgement.
          </p>
          {result && (
            <button
              onClick={async () => {
                const { buildMarkdownReport } = await import("@/lib/report");
                const md = buildMarkdownReport(result, { filename: file?.name });
                try {
                  await navigator.clipboard.writeText(md);
                  setError(null);
                } catch {
                  const ta = document.createElement("textarea");
                  ta.value = md;
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand("copy");
                  document.body.removeChild(ta);
                }
                const el = document.activeElement as HTMLButtonElement | null;
                if (el) {
                  const old = el.textContent;
                  el.textContent = "Copied!";
                  setTimeout(() => {
                    if (el.isConnected) el.textContent = old;
                  }, 1200);
                }
              }}
              className="rounded-md border border-[#e2e2e2] px-3 py-1.5 font-mono text-[12px] font-medium text-[#4d4d4d] transition-colors hover:border-[#b0b0b0] hover:text-[#171717]"
            >
              Copy report as Markdown
            </button>
          )}
        </div>
      </footer>

      <div data-print="hide">
        <ConsentBanner
          open={!consent && !bannerDismissed}
          onAccept={acceptFromBanner}
          onDecline={() => setBannerDismissed(true)}
        />
      </div>
    </main>
  );
}

const RUBRIC = [
  { label: "Impact", weight: 22, hot: true },
  { label: "Structure", weight: 16, hot: true },
  { label: "Experience", weight: 14, hot: true },
  { label: "Skills", weight: 12 },
  { label: "Verbs / Length", weight: 10 },
  { label: "ATS / Contact", weight: 8 },
  { label: "Language", weight: 4 },
  { label: "Polish", weight: 4 },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#b0b0b0]">{label}</div>
      <div className="mt-0.5 font-mono text-[24px] font-medium tabular-nums tracking-[-0.96px] text-[#171717]">
        {value}
      </div>
    </div>
  );
}