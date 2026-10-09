export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-[1080px] px-5 py-12 sm:px-8"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mb-10 space-y-4">
        <div className="h-3 w-40 animate-pulse rounded-full bg-[#ebebeb]" />
        <div className="h-10 w-80 max-w-full animate-pulse rounded-md bg-[#ebebeb]" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded bg-[#f0f0f0]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="h-72 animate-pulse rounded-lg bg-[#fafafa] shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px]" />
        <div className="h-72 animate-pulse rounded-lg bg-[#fafafa] shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px]" />
      </div>
      <span className="sr-only">Loading…</span>
    </main>
  );
}