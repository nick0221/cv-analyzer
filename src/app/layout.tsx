import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Quality Analyzer",
  description:
    "Upload a resume and get a quality score, a breakdown by dimension, and prioritized, actionable fixes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-950 font-sans text-zinc-100">{children}</body>
    </html>
  );
}
