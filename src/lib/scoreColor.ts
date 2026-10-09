export interface ScoreColor {
  text: string;
  ring: string;
  bar: string;
  bg: string;
  label: string;
  /** Pill badge on the results header (restrained, monochrome-first). */
  badge: string;
}

export function scoreColor(score: number): ScoreColor {
  if (score >= 85)
    return {
      text: "text-[#067647]",
      ring: "text-[#067647]",
      bar: "bg-[#067647]",
      bg: "bg-[#f5fbf7] border-[#c9e6d4]",
      label: "Strong",
      badge: "bg-[#f5fbf7] text-[#067647]",
    };
  if (score >= 70)
    return {
      text: "text-[#0d7a3f]",
      ring: "text-[#0d7a3f]",
      bar: "bg-[#4aa85f]",
      bg: "bg-[#f2faf4] border-[#cfe8d6]",
      label: "Good",
      badge: "bg-[#f2faf4] text-[#0d7a3f]",
    };
  if (score >= 55)
    return {
      text: "text-[#b54708]",
      ring: "text-[#b54708]",
      bar: "bg-[#d97706]",
      bg: "bg-[#fff8ed] border-[#f2ddc0]",
      label: "Needs work",
      badge: "bg-[#fff8ed] text-[#b54708]",
    };
  return {
    text: "text-[#b42318]",
    ring: "text-[#b42318]",
    bar: "bg-[#d92d20]",
    bg: "bg-[#fef3f2] border-[#f4c7c3]",
    label: "Weak",
    badge: "bg-[#fef3f2] text-[#b42318]",
  };
}

export const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-[#fef3f2] text-[#b42318] border-[#f4c7c3]",
  medium: "bg-[#fff8ed] text-[#b54708] border-[#f2ddc0]",
  low: "bg-[#f0f4ff] text-[#0a5fd0] border-[#c7dafe]",
};