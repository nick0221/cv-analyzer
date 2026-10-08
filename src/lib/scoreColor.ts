export interface ScoreColor {
  text: string;
  ring: string;
  bar: string;
  bg: string;
  label: string;
}

export function scoreColor(score: number): ScoreColor {
  if (score >= 85) return { text: "text-emerald-400", ring: "text-emerald-400", bar: "bg-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", label: "Strong" };
  if (score >= 70) return { text: "text-lime-400", ring: "text-lime-400", bar: "bg-lime-400", bg: "bg-lime-400/10 border-lime-400/30", label: "Good" };
  if (score >= 55) return { text: "text-amber-400", ring: "text-amber-400", bar: "bg-amber-400", bg: "bg-amber-400/10 border-amber-400/30", label: "Needs work" };
  return { text: "text-rose-400", ring: "text-rose-400", bar: "bg-rose-400", bg: "bg-rose-400/10 border-rose-400/30", label: "Weak" };
}

export const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-sky-500/15 text-sky-300 border-sky-500/30",
};
