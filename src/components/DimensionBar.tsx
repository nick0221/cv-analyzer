"use client";

import { scoreColor } from "@/lib/scoreColor";

export function DimensionBar({
  label,
  score,
  summary,
  findings,
}: {
  label: string;
  score: number;
  summary: string;
  findings: string[];
}) {
  const color = scoreColor(score);
  return (
    <div className="rounded-lg bg-white p-4 shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px,rgba(0,0,0,0.04)_0px_8px_8px_-8px,#fafafa_0px_0px_0px_1px]">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[15px] font-medium tracking-[-0.32px] text-[#171717]">{label}</h3>
        <span className={`font-mono text-[13px] font-medium tabular-nums ${color.text}`}>
          {score}/100
        </span>
      </div>
      <div className="mt-2.5 h-[5px] w-full overflow-hidden rounded-full bg-[#f0f0f0]">
        <div
          className={`h-full rounded-full ${color.bar}`}
          style={{ width: `${score}%`, transition: "width 700ms cubic-bezier(.22,1,.36,1)" }}
        />
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-[#4d4d4d]">{summary}</p>
      {findings.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-[#f0f0f0] pt-2">
          {findings.map((f, i) => (
            <li key={i} className="text-xs leading-relaxed text-[#808080]">
              <span className="font-mono text-[#b0b0b0]">▸</span> {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}