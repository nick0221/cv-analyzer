import { ImageResponse } from "next/og";

export const alt = "Resume Quality Analyzer — score your CV and get prioritized fixes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social/OG card, generated at build time (no external asset needed). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          background: "linear-gradient(135deg, #09090b 0%, #18181b 55%, #0c4a6e 100%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#0ea5e9",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            CV
          </div>
          <div style={{ fontSize: 28, color: "#94a3b8", letterSpacing: 1 }}>
            RESUME QUALITY ANALYZER
          </div>
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>
          Score your resume.
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1, color: "#38bdf8", letterSpacing: -1 }}>
          Fix what holds it back.
        </div>
        <div style={{ marginTop: 32, fontSize: 30, color: "#a1a1aa", maxWidth: 900 }}>
          9-dimension scoring, prioritized fixes, optional job-description match.
        </div>
      </div>
    ),
    size,
  );
}
