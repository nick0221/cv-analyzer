import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Resume Quality Analyzer — score your CV and get fixes",
    template: "%s · Resume Quality Analyzer",
  },
  description:
    "Upload or paste your resume and get a quality score across 9 dimensions, a breakdown of what is weak, and prioritized, actionable fixes. Optionally match it against a job description.",
  applicationName: "Resume Quality Analyzer",
  keywords: [
    "resume analyzer",
    "CV checker",
    "resume score",
    "ATS check",
    "resume review",
    "job description match",
  ],
  authors: [{ name: "Resume Quality Analyzer" }],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Resume Quality Analyzer",
    title: "Resume Quality Analyzer — score your CV and get fixes",
    description:
      "Score your resume across 9 dimensions and get prioritized, actionable fixes — no signup, your CV is not stored.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Resume Quality Analyzer",
    description:
      "Score your resume across 9 dimensions and get prioritized, actionable fixes — no signup, your CV is not stored.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-950 font-sans text-zinc-100">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
