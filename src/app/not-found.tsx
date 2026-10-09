import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[1080px] flex-col items-center justify-center px-5 py-12 text-center sm:px-8">
      <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[#808080]">404</p>
      <h1 className="mt-3 text-[32px] font-semibold tracking-[-1.28px] text-[#171717]">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[#4d4d4d]">
        That page doesn&apos;t exist. Head back to the analyzer to score your resume.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-[#171717] px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-black"
      >
        Back to the analyzer
      </Link>
    </main>
  );
}