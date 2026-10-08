"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center px-5 py-12 text-center">
      <h1 className="text-2xl font-bold text-zinc-50">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-400">
        The page hit an unexpected error. You can try again — your resume text is not stored.
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-zinc-600">Reference: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-400"
      >
        Try again
      </button>
    </main>
  );
}
