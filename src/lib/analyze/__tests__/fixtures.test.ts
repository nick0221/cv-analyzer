import { describe, it, expect } from "vitest";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "fixtures");
mkdirSync(OUT, { recursive: true });

const RESUME_LINES = [
  "Jane Doe",
  "jane.doe@example.com | +1 555 123 4567 | linkedin.com/in/janedoe",
  "",
  "Summary",
  "Senior software engineer with 8 years building high-scale web platforms.",
  "",
  "Experience",
  "Senior Software Engineer, Acme Corp - Mar 2021 - Present",
  "- Led a team of 6 engineers to rebuild the checkout flow, increasing conversion 23%.",
  "- Reduced page load time 45% by migrating to edge rendering, cutting $120K in infra costs.",
  "- Shipped 14 features across 2023, growing monthly active users from 40K to 115K.",
  "Software Engineer, Globex - Jun 2018 - Feb 2021",
  "- Built a payments service processing $8M/month with 99.99% uptime.",
  "- Automated regression tests, cutting release cycles from 5 days to 1 day.",
  "",
  "Education",
  "B.Sc. Computer Science, State University, 2018",
  "",
  "Skills",
  "TypeScript, React, Next.js, Node.js, PostgreSQL, AWS, CI/CD, GraphQL",
];

function writePdf(path: string) {
  return new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => {
      writeFileSync(path, Buffer.concat(chunks));
      resolve();
    });
    doc.on("error", reject);
    doc.fontSize(11).text(RESUME_LINES.join("\n"));
    doc.end();
  });
}

async function writeDocx(path: string) {
  const doc = new Document({
    sections: [
      {
        children: RESUME_LINES.map(
          (line) => new Paragraph({ children: [new TextRun(line)] }),
        ),
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  writeFileSync(path, buffer);
}

describe("generate fixtures", () => {
  it("writes a sample PDF", async () => {
    const p = join(OUT, "sample-resume.pdf");
    await writePdf(p);
    expect(true).toBe(true);
  });

  it("writes a sample DOCX", async () => {
    const p = join(OUT, "sample-resume.docx");
    await writeDocx(p);
    expect(true).toBe(true);
  });
});
