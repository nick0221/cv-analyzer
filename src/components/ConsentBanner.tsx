"use client";

import { useState } from "react";

const CONSENT_COOKIE = "cv-consent";
const CONSENT_VALUE = "accepted";

export function getConsent(): "accepted" | "declined" | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=([^;]*)`),
  );
  return match ? (match[1] === CONSENT_VALUE ? "accepted" : "declined") : null;
}

/** Set a consent cookie. Default max-age 1 year, or ~5s for "declined". */
export function setConsent(value: "accepted" | "declined") {
  const maxAge = value === "accepted" ? 60 * 60 * 24 * 365 : 5;
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function ConsentBanner({ onConsent }: { onConsent: (value: "accepted" | "declined") => void }) {
  const [visible, setVisible] = useState(true);

  function choose(value: "accepted" | "declined") {
    setConsent(value);
    setVisible(false);
    onConsent(value);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-900/95 px-5 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-300">
          This app analyzes the resume/CV you upload or paste — including its content, to score
          and recommend improvements. Your data is used for that analysis only and is not stored
          or shared. By analyzing, you agree to this use. You can decline and still browse.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => choose("declined")}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-400 hover:text-zinc-100"
          >
            Decline
          </button>
          <button
            onClick={() => choose("accepted")}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-400"
          >
            Accept &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
}