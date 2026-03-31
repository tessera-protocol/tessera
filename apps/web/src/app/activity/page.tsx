"use client";

import { activityItems } from "@/lib/mock-data";

export default function ActivityPage() {
  return (
    <div className="space-y-5">
      <header>
        <p className="font-[var(--font-dm-mono)] text-xs uppercase tracking-[0.24em] text-[#55556a]">
          verification log
        </p>
        <h1 className="mt-2 font-[var(--font-fraunces)] text-4xl font-semibold tracking-[-0.03em]">
          Activity
        </h1>
        <p className="mt-2 text-sm text-[#8888a0]">
          Placeholder timeline of recent passport and agent actions.
        </p>
      </header>

      <div className="space-y-3">
        {activityItems.map((item) => (
          <div key={item.id} className="rounded-[1.5rem] border border-white/8 bg-[#16161f] p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-medium text-[#e0e0e8]">{item.title}</h2>
              <span className="text-xs text-[#55556a]">{item.timestamp}</span>
            </div>
            <p className="mt-2 text-sm text-[#8888a0]">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
