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
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#ebebeb] bg-white/95 px-5 py-4 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-[#4d4d4d]">
          This app analyzes the resume/CV you upload or paste — including its content — to score it
          and recommend improvements. Your data is used for that analysis only and is{" "}
          <span className="font-medium text-[#171717]">not stored or shared</span>. Choose an option
          below; you can also tick the consent box in the form.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onDecline}
            className="rounded-md border border-[#e2e2e2] px-3.5 py-2 text-[13px] font-medium text-[#4d4d4d] transition-colors hover:border-[#b0b0b0] hover:text-[#171717]"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="rounded-md bg-[#171717] px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-black"
          >
            Accept &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
}