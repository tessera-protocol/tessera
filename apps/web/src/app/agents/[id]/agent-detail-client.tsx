"use client";

import Link from "next/link";
import { agents } from "@/lib/mock-data";

export function AgentDetailClient({ id }: { id: string }) {
  const agent = agents.find((item) => item.id === id) ?? agents[0];

  return (
    <div className="space-y-5">
      <Link href="/agents" className="text-sm text-[#7F77DD]">
        ← Back to agents
      </Link>
      <header>
        <p className="font-[var(--font-dm-mono)] text-xs uppercase tracking-[0.24em] text-[#55556a]">
          delegated wallet
        </p>
        <h1 className="mt-2 font-[var(--font-fraunces)] text-4xl font-semibold tracking-[-0.03em]">
          {agent.name}
        </h1>
      </header>

      <section className="space-y-3 rounded-[1.75rem] border border-white/8 bg-[#16161f] p-5">
        <DetailRow label="Status" value={agent.status} />
        <DetailRow label="Scope" value={agent.scope} />
        <DetailRow label="Purpose" value={agent.description} />
        <DetailRow label="Expiry" value="07 Apr 2026 · 23:59 UTC" />
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/6 bg-white/[0.02] p-4">
      <p className="font-[var(--font-dm-mono)] text-[0.62rem] uppercase tracking-[0.22em] text-[#55556a]">
        {label}
      </p>
      <p className="mt-2 text-sm text-[#e0e0e8]">{value}</p>
    </div>
  );
}
