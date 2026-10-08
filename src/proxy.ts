import { NextResponse } from "next/server";

/**
 * Adds security headers to every response.
 *
 * NOTE: Next.js 16 renamed the `middleware` file convention to `proxy`
 * (src/proxy.ts, exporting `proxy()`). The behaviour is equivalent here — we
 * only set response headers on the way through.
 *
 * CSP is deliberately pragmatic: Next injects inline bootstrap scripts, so
 * 'unsafe-inline' is required for script-src unless you move to a nonce-based
 * setup. Everything else is strict.
 */
export function proxy() {
  const res = NextResponse.next();

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  return res;
}

export const config = {
  // Everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
