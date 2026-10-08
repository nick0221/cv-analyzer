# Resume Analyzer — Senior-Dev Improvement Roadmap

Audit of the current app (post consent-banner work), ranked by impact ÷ effort.
Excludes LLM/AI work, which is deferred by request.

## Tier 1 — Production correctness & safety (do first)

### 1. Rate limiting on `/api/analyze`  ⚠️ highest impact
- **Problem:** public, unauthenticated endpoint accepting 10 MB uploads + PDF
  parsing. Trivial DoS / cost-abuse target; one script and the function bill spikes.
- **Fix:** per-IP token bucket. Options: Upstash Redis `@upstash/ratelimit` (Vercel-native,
  distributed) or an in-memory limiter for a first pass. Return `429` with `Retry-After`.
- **Also:** hard cap parsed work (timeout), `Cache-Control: no-store`.

### 2. Security headers / CSP
- **Problem:** no `middleware.ts`; no CSP, `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`.
- **Fix:** `middleware.ts` (or `next.config` headers) adding the standard set. CSP must
  allow Next's inline bootstrap; keep it strict elsewhere. ~20 min, real value given uploads.

### 3. Error / loading / not-found boundaries
- **Problem:** no `app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx`. Render errors
  dump users to the default screen; unknown routes hit the stock 404; no skeleton while
  a large PDF parses.
- **Fix:** branded `error.tsx` (with `reset()`), a `loading.tsx` skeleton, a `not-found.tsx`.

### 4. API route tests
- **Problem:** all 33 tests are pure-logic; the route's real branches are untested.
- **Fix:** route tests for consent `403`, oversize `413`, unsupported `415`, empty-extraction
  fallback, and the happy path — with a constructed `Request`/`FormData`.

## Tier 2 — Accessibility (currently a failure)

### 5. Keyboard & screen-reader support
- **Problem:** the dropzone is a clickable `<div>` — no keyboard focus, no `role="button"`,
  no Enter/Space handler; the file input is `display:none`; **0** `aria-*` in the app.
  A keyboard/SR user cannot upload at all.
- **Fix:** dropzone → real `<button>`; label all inputs; `aria-live="polite"` on the results
  region (announce score); give the gauge an `aria-label`; ensure focus ring visibility;
  verify contrast on the dark theme.

## Tier 3 — Quality, DX, trust

### 6. CI (GitHub Actions)
- Gate every push/PR on `npm run typecheck && npm test && npm run lint && npm run build`.

### 7. Upload hardening
- Magic-byte sniffing so a renamed non-PDF is rejected before the parser; keep the
  client guard as UX only, server as truth.

### 8. Observability
- Structured log of analysis events (count, elapsed, failure) + Vercel Analytics.
- Later: aggregate which dimensions score lowest to steer product decisions.

### 9. Dead code
- `src/lib/analyze/llm.ts` is imported nowhere — remove; re-add with AI integration.

### 10. SEO / metadata / OG
- `robots.ts`, `sitemap.ts`, OpenGraph image, per-route metadata.

## Explicitly NOT recommended
State-management libs, component library, leaving Tailwind, theme toggle.
Low value, added surface area.

## Suggested batching
- **Batch A (this milestone):** items 1–5 → "safe + usable product."
- **Batch B:** items 6–9.
- **Batch C:** item 10.
