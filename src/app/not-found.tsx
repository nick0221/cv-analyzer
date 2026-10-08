import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center px-5 py-12 text-center">
      <p className="text-sm font-semibold text-sky-400">404</p>
      <h1 className="mt-2 text-2xl font-bold text-zinc-50">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-400">
        That page doesn&apos;t exist. Head back to the analyzer to score your resume.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-400"
      >
        Back to the analyzer
      </Link>
    </main>
  );
}
