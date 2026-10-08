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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-medium text-zinc-100">{label}</h3>
        <span className={`text-sm font-semibold ${color.text}`}>{score}/100</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full ${color.bar}`} style={{ width: `${score}%`, transition: "width 700ms ease" }} />
      </div>
      <p className="mt-2 text-sm text-zinc-400">{summary}</p>
      {findings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {findings.map((f, i) => (
            <li key={i} className="text-xs text-zinc-500">• {f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
