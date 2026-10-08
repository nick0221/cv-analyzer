"use client";

/**
 * Consent is modeled as a tiny external store so React can read it in a
 * hydration-safe way via useSyncExternalStore (server snapshot = not accepted).
 */

export const CONSENT_COOKIE = "cv-consent";
export const CONSENT_VALUE = "accepted";

const listeners = new Set<() => void>();

/** Read the consent cookie from the browser. */
function readCookie(): boolean {
  if (typeof document === "undefined") return false;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=([^;]*)`),
  );
  return !!match && match[1] === CONSENT_VALUE;
}

function writeCookie(accepted: boolean) {
  const maxAge = accepted ? 60 * 60 * 24 * 365 : 0;
  const value = accepted ? CONSENT_VALUE : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function emit() {
  for (const l of listeners) l();
}

/** Subscribe/getSnapshot pair for useSyncExternalStore. */
export function subscribeConsent(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getConsentSnapshot(): boolean {
  return readCookie();
}

/** Server render: assume no consent (nothing is analyzed before hydration). */
export function getConsentServerSnapshot(): boolean {
  return false;
}

/** Accept: persist for one year. */
export function setConsent() {
  writeCookie(true);
  emit();
}

/** Withdraw: clear the cookie. */
export function clearConsent() {
  writeCookie(false);
  emit();
}
