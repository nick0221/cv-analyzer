"use client";

/**
 * Bottom consent banner. Controlled by the parent so it stays in sync with the
 * in-form checkbox: both read/write the same `cv-consent` cookie.
 */
export function ConsentBanner({
  open,
  onAccept,
  onDecline,
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-900/95 px-5 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-300">
          This app analyzes the resume/CV you upload or paste — including its content — to score it
          and recommend improvements. Your data is used for that analysis only and is not stored or
          shared. Choose an option below; you can also tick the consent box in the form.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onDecline}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-400 hover:text-zinc-100"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-400"
          >
            Accept &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
}
