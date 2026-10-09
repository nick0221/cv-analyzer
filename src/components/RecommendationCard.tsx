"use client";

import type { Recommendation } from "@/lib/types";
import { PRIORITY_STYLES } from "@/lib/scoreColor";
import { deltaFor } from "@/lib/deltas";

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const delta = deltaFor(rec.title, rec.why, rec.fix);
  return (
    <div className="rounded-lg bg-white p-5 shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px,rgba(0,0,0,0.04)_0px_8px_8px_-8px,#fafafa_0px_0px_0px_1px]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-medium leading-snug tracking-[-0.32px] text-[#171717]">
          {rec.title}
        </h3>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] ${PRIORITY_STYLES[rec.priority] ?? PRIORITY_STYLES.low}`}
        >
          {rec.priority}
        </span>
      </div>

      <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#4d4d4d]">
        <p>
          <span className="font-medium text-[#171717]">Why — </span>
          {rec.why}
        </p>
        <p>
          <span className="font-medium text-[#171717]">Fix — </span>
          {rec.fix}
        </p>
      </div>

      {delta && (
        <div className="mt-3 grid gap-px overflow-hidden rounded-md bg-[#ebebeb] sm:grid-cols-2">
          <div className="bg-[#fdf6f5] p-3">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#b54708]">before</p>
            <p className="font-mono text-[12.5px] leading-snug text-[#9a3412]">− {delta.before}</p>
          </div>
          <div className="bg-[#f5fbf7] p-3">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#067647]">after</p>
            <p className="font-mono text-[12.5px] leading-snug text-[#065f46]">+ {delta.after}</p>
          </div>
        </div>
      )}
    </div>
  );
}