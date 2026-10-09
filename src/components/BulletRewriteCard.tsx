"use client";

import type { BulletRewrite } from "@/lib/types";

/**
 * A single AI-rewritten bullet, shown as a before/after diff — the same visual
 * language as the rules-engine recommendation deltas, so the whole report reads
 * as one system. The rewrite is copy-ready.
 */
export function BulletRewriteCard({ rewrite }: { rewrite: BulletRewrite }) {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px,rgba(0,0,0,0.04)_0px_8px_8px_-8px,#fafafa_0px_0px_0px_1px]">
      <div className="grid gap-px bg-[#ebebeb] sm:grid-cols-2">
        <div className="bg-[#fdf6f5] p-3.5">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#b54708]">
            before
          </p>
          <p className="text-[13px] leading-snug text-[#9a3412]">
            <span className="font-mono">− </span>
            {rewrite.original}
          </p>
        </div>
        <div className="bg-[#f5fbf7] p-3.5">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#067647]">
            after
          </p>
          <p className="text-[13px] font-medium leading-snug text-[#065f46]">
            <span className="font-mono">+ </span>
            {rewrite.rewrite}
          </p>
        </div>
      </div>
      {rewrite.why && (
        <p className="border-t border-[#f0f0f0] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#808080]">
          {rewrite.why}
        </p>
      )}
    </div>
  );
}
