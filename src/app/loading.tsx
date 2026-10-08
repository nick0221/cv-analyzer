export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12" aria-busy="true" aria-live="polite">
      <div className="mb-8 space-y-3">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-zinc-800/70" />
      </div>
      <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="h-32 w-full animate-pulse rounded-xl bg-zinc-800/60" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-zinc-800/60" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-zinc-800/60" />
      </div>
      <span className="sr-only">Loading…</span>
    </main>
  );
}
