"use client";

import Link from "next/link";
import { TesseraMark } from "@/components/tessera-mark";
import { agents } from "@/lib/mock-data";

export default function AgentsPage() {
  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="font-[var(--font-dm-mono)] text-xs uppercase tracking-[0.24em] text-[#55556a]">
            agent wallets
          </p>
          <h1 className="mt-2 font-[var(--font-fraunces)] text-4xl font-semibold tracking-[-0.03em]">
            Agents
          </h1>
        </div>
        <Link
          href="/agents/new"
          className="rounded-full bg-[#534AB7] px-4 py-2 text-sm font-medium text-white"
        >
          New wallet
        </Link>
      </header>

      <div className="space-y-3">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={`/agents/${agent.id}`}
            className="flex items-start gap-4 rounded-[1.5rem] border border-white/8 bg-[#16161f] p-4"
          >
            <div className="rounded-2xl bg-white/5 p-2">
              <TesseraMark size={28} variant={agent.status === "Paused" ? "grey" : "two-tone"} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-medium text-[#e0e0e8]">{agent.name}</h2>
                <span className="text-xs text-[#8888a0]">{agent.status}</span>
              </div>
              <p className="mt-1 text-sm text-[#8888a0]">{agent.description}</p>
              <p className="mt-3 font-[var(--font-dm-mono)] text-xs uppercase tracking-[0.18em] text-[#AFA9EC]">
                {agent.scope}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
