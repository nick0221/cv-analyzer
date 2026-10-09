"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  // Declining the banner hides it for this session (without accepting).
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getConsentServerSnapshot,
  );
  const inputRef = useRef<HTMLInputElement>(null);

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
    // Coarse funnel signal only — never the filename or contents.
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
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong analyzing the resume.");
        track("resume_analyze_failed", { status: res.status });
        return;
      }
      const parsed = data as AnalysisResult;
      setResult(parsed);
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
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Resume Quality Analyzer</h1>
        <p className="mt-2 text-zinc-400">
          Upload your resume to get a quality score, a breakdown by dimension, and prioritized fixes.
        </p>
      </header>

      <section className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div>
          <label htmlFor="resume-file" className="mb-2 block text-sm font-medium text-zinc-300">Resume file (PDF, DOCX or TXT)</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onPick(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
              dragging ? "border-sky-400 bg-sky-400/5" : "border-zinc-700"
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
              <p className="text-sm text-zinc-200">
                Selected: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(0)} KB)
              </p>
            ) : (
              <>
                <p className="text-sm text-zinc-300">Drag &amp; drop your resume here</p>
                <label
                  htmlFor="resume-file"
                  className="mt-2 cursor-pointer rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-400 hover:bg-zinc-800/60 focus-within:outline-none"
                >
                  Choose a file
                </label>
                <p id="resume-file-hint" className="mt-2 text-xs text-zinc-500">
                  Text-based PDF, DOCX, TXT — max 10 MB
                </p>
              </>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="resume-text" className="mb-2 block text-sm font-medium text-zinc-300">
            …or paste the resume text
          </label>
          <textarea
            id="resume-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Paste your resume text here (use this for scanned PDFs)."
            className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="job-description" className="mb-2 block text-sm font-medium text-zinc-300">
            Target job description <span className="text-zinc-500">(optional — adds keyword matching)</span>
          </label>
          <textarea
            id="job-description"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={4}
            placeholder="Paste the job posting to see which keywords your resume is missing."
            className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => onConsentToggle(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-sky-500"
          />
          <span className="text-sm text-zinc-300">
            I agree that my resume/CV content will be sent to and analyzed by this app to produce a
            quality score and recommendations. It is processed for this purpose only and not stored.
          </span>
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={analyze}
            disabled={loading || !consent}
            className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Analyze resume"}
          </button>
          {(file || text || result) && (
            <button onClick={reset} className="text-sm text-zinc-400 hover:text-zinc-200">Reset</button>
          )}
        </div>
      </section>

      {result && (
        <section
          className="mt-8 space-y-6"
          aria-live="polite"
          aria-label="Analysis results"
        >
          <p className="sr-only">
            Analysis complete. Score {result.score} out of 100, grade {result.grade}.{" "}
            {result.recommendations.length} recommendation
            {result.recommendations.length === 1 ? "" : "s"}.
          </p>
          {result.warnings.length > 0 && (
            <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-200">⚠ {w}</p>
              ))}
            </div>
          )}

          <div className="flex flex-col items-center gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:flex-row sm:items-center">
            <ScoreGauge score={result.score} grade={result.grade} />
            <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Stat label="Words" value={result.wordCount.toLocaleString()} />
              <Stat label="Bullets" value={result.bulletCount} />
              <Stat label="Est. pages" value={result.estimatedPages} />
              <Stat label="Dimensions" value={result.dimensions.length} />
              <Stat label="Fixes" value={result.recommendations.length} />
              {result.match.provided && <Stat label="JD match" value={`${result.match.score}%`} />}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-zinc-100">Score breakdown</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.dimensions.map((d) => (
                <DimensionBar key={d.key} label={d.label} score={d.score} summary={d.summary} findings={d.findings} />
              ))}
            </div>
          </div>

          {result.match.provided && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-zinc-100">Job description match</h2>
                <span className="text-sm font-semibold text-zinc-300">{result.match.score}%</span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {result.match.mustHaveMissing.length > 0 && (
                  <p className="text-zinc-400">
                    <span className="font-medium text-orange-400">Required but missing ({result.match.mustHaveMissing.length}): </span>
                    {result.match.mustHaveMissing.join(", ")}
                  </p>
                )}
                <p className="text-zinc-400">
                  <span className="font-medium text-emerald-400">Matched ({result.match.keywordsFound.length}): </span>
                  {result.match.keywordsFound.join(", ") || "none"}
                </p>
                <p className="text-zinc-400">
                  <span className="font-medium text-rose-400">Missing ({result.match.keywordsMissing.length}): </span>
                  {result.match.keywordsMissing.join(", ") || "none"}
                </p>
                {result.match.buriedKeywords.length > 0 && (
                  <p className="text-zinc-400">
                    <span className="font-medium text-amber-400">Buried after Experience ({result.match.buriedKeywords.length}): </span>
                    {result.match.buriedKeywords.join(", ")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-3 text-lg font-semibold text-zinc-100">Recommendations</h2>
            {result.recommendations.length === 0 ? (
              <p className="text-sm text-zinc-400">No issues found — the resume looks solid.</p>
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

      <footer className="mt-12 border-t border-zinc-800 pt-6 text-xs text-zinc-500">
        Analysis runs on the server and is not stored. Recommendations are heuristic — always use your own judgement.
        {result && (
          <div className="mt-2">
            <button
              onClick={async () => {
                const { buildMarkdownReport } = await import("@/lib/report");
                const md = buildMarkdownReport(result, { filename: file?.name });
                try {
                  await navigator.clipboard.writeText(md);
                  setError(null);
                } catch {
                  // Fallback: prompt user to copy
                  const ta = document.createElement("textarea");
                  ta.value = md;
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand("copy");
                  document.body.removeChild(ta);
                }
                // Simple transient feedback via button label
                const el = document.activeElement as HTMLButtonElement | null;
                if (el) {
                  const old = el.textContent;
                  el.textContent = "Copied!";
                  setTimeout(() => {
                    if (el.isConnected) el.textContent = old;
                  }, 1200);
                }
              }}
              className="text-sky-400 hover:text-sky-300 underline"
            >
              Copy report as Markdown
            </button>
          </div>
        )}
      </footer>

      <ConsentBanner
        open={!consent && !bannerDismissed}
        onAccept={acceptFromBanner}
        onDecline={() => setBannerDismissed(true)}
      />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="font-semibold text-zinc-100">{value}</div>
    </div>
  );
}
