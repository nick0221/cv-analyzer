# Resume Quality Analyzer

A small Next.js web app that scores a resume, explains the score across six
dimensions, and returns prioritized, actionable fixes. Optionally matches the
resume against a target job description.

Everything runs server-side and stateless — no database, no account, nothing stored.

## What it checks

| Dimension | Weight | What it looks at |
|---|---|---|
| Quantified impact | 22% | Share of bullets containing a number/metric |
| Structure & sections | 16% | Contact block, Summary, Experience, Education, Skills |
| Experience & chronology | 14% | Date ranges, job titles, career timeline coherence |
| Skills & technologies | 12% | Skills breadth, dedicated section, keyword presence |
| Action verbs | 10% | Bullets opening with strong verbs vs. "Responsible for…" |
| Length & density | 10% | Word count, page estimate, overlong bullets, bullet count |
| ATS-safe formatting | 8% | Multi-column layout, date ranges, header/footer traps, emoji |
| Language & typos | 4% | Common misspellings, doubled words, first-person, tense mix |
| Links & professional polish | 4% | LinkedIn/GitHub/portfolio links, awards/certifications, consistency |

The overall score is the weighted average of the nine dimensions; the job match is
reported separately and adds its own recommendation.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Open the app, upload a PDF/DOCX/TXT or paste the resume text, optionally paste a
job description, and click **Analyze resume**.

### Optional: AI wording enhancement

The scoring is fully deterministic and runs locally on your server. There is an
optional checkbox, *"Improve wording with AI"*, that sends the resume text plus
the computed findings to an OpenAI-compatible endpoint to rewrite the feedback
more specifically. It is **opt-in, off by default, and changes nothing about the
score** — only the phrasing of the recommendations.

Enable it by setting these environment variables (otherwise the checkbox is a
silent no-op):

```bash
OPENAI_API_KEY=sk-...                 # required to turn the feature on
OPENAI_MODEL=gpt-4o-mini              # optional, this is the default
OPENAI_BASE_URL=https://api.openai.com   # optional; any OpenAI-compatible root
```

Because a resume is personal data, the request is only made when the user ticks
the box, and a failure (bad key, rate limit, malformed response) degrades
gracefully back to the deterministic analysis with a warning rather than an error.

### Export

After a run, *"Copy report as Markdown"* in the footer copies the full report
(score, per-dimension findings, job-match, and all recommendations) to the
clipboard, ready to paste into a doc or issue tracker.

### Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run start       # serve the production build
npm test            # vitest suite
npm run test:watch  # vitest in watch mode
npm run lint        # eslint
```

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new) — Next.js is detected automatically.
3. Deploy. No environment variables are required.

Notes:

- `/api/analyze` runs on the Node.js runtime (the default) and requests a
  30-second `maxDuration` for large PDFs.
- Uploads are capped at 10 MB, checked both in the browser and on the server.
- `next.config.ts` enables Cache Components, which disallows the `runtime`
  route-segment export — do not re-add `export const runtime = "nodejs"` to the
  API route or the build will fail.

## Architecture

```
src/
  app/
    page.tsx              # the whole UI (client component)
    layout.tsx
    api/analyze/route.ts  # POST multipart → extract → analyze → JSON
  components/
    ScoreGauge.tsx        # SVG score ring
    DimensionBar.tsx      # per-dimension bar + findings
    RecommendationCard.tsx
  lib/
    types.ts              # shared result/request types
    scoreColor.ts         # score → colour bands
    parse/
      extract.ts          # file-type dispatch, size limit, empty-text detection
      pdf.ts              # unpdf text extraction + text normalisation
      docx.ts             # mammoth text extraction
    analyze/
      engine.ts           # runs all rules, weighted score, dedupe/sort
      text.ts             # tokenising, bullets, metrics, stemming, stopwords
      lexicon.ts          # strong verbs, weak openers, filler phrases
      match.ts            # job-description keyword overlap
      rules/              # one pure function per dimension
        structure.ts impact.ts verbs.ts length.ts ats.ts language.ts
      __tests__/          # vitest suites
```

Every rule module is a pure function `(text) => DimensionResult`, so adding a
dimension means adding one file and one line in `engine.ts`.

## Testing

```bash
npm test
```

The suite covers the scoring engine, each rule, keyword matching and text
utilities. `src/lib/analyze/__tests__/fixtures.test.ts` generates
`fixtures/sample-resume.pdf` and `.docx` on first run — useful for manual
end-to-end testing:

```bash
curl -X POST http://localhost:3000/api/analyze -F 'file=@fixtures/sample-resume.pdf'
```

## Known limitations

- Scanned/image-only PDFs yield no extractable text; the app detects this and
  tells the user to paste the text instead.
- Score rules are heuristics tuned by eye, not a trained model. They are
  deliberately conservative and explain every deduction.
- The job-description matcher uses stemmed token overlap plus a curated
  alias table (`src/lib/analyze/synonyms.ts`), not embeddings. It handles common
  equivalences (Postgres/PostgreSQL, k8s/Kubernetes, JS/JavaScript, AWS/Amazon
  Web Services, ML/Machine Learning, …) but will still miss synonyms that are
  not in the alias list. Extend `ALIAS_GROUPS` to add more.
