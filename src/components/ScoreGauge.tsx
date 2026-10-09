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
        className="relative h-[184px] w-[184px]"
        role="img"
        aria-label={`Quality score ${score} out of 100, grade ${grade}`}
      >
        <svg
          className="h-[184px] w-[184px] -rotate-90"
          viewBox="0 0 128 128"
          aria-hidden="true"
          focusable="false"
        >
          {/* Track: shadow-as-border ring */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="#ebebeb"
            strokeWidth="10"
          />
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
            style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.22,1,.36,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          <span className={`font-sans text-[44px] font-semibold leading-none tracking-[-2.4px] ${color.text}`}>
            {score}
          </span>
          <span className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[#808080]">
            grade {grade}
          </span>
        </div>
      </div>
      <p className={`mt-2 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${color.badge}`}>
        {color.label}
      </p>
    </div>
  );
}