"use client";

import { scoreColor } from "@/lib/scoreColor";

export function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative h-36 w-36"
        role="img"
        aria-label={`Quality score ${score} out of 100, grade ${grade}`}
      >
        <svg className="h-36 w-36 -rotate-90" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-zinc-800" />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={color.ring}
            style={{ transition: "stroke-dashoffset 700ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          <span className={`text-4xl font-bold ${color.text}`}>{score}</span>
          <span className="text-xs uppercase tracking-wide text-zinc-500">Grade {grade}</span>
        </div>
      </div>
    </div>
  );
}
