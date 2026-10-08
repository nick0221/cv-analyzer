import type { Recommendation } from "@/lib/types";
import { PRIORITY_STYLES } from "@/lib/scoreColor";

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-zinc-100">{rec.title}</h3>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLES[rec.priority] ?? PRIORITY_STYLES.low}`}>
          {rec.priority}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        <span className="font-medium text-zinc-300">Why: </span>
        {rec.why}
      </p>
      <p className="mt-2 text-sm text-zinc-400">
        <span className="font-medium text-zinc-300">Fix: </span>
        {rec.fix}
      </p>
    </div>
  );
}
