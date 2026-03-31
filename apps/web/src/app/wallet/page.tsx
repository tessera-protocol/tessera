"use client";

import { walletSummary } from "@/lib/mock-data";

export default function WalletPage() {
  return (
    <div className="space-y-5">
      <header>
        <p className="font-[var(--font-dm-mono)] text-xs uppercase tracking-[0.24em] text-[#55556a]">
          escrow wallet
        </p>
        <h1 className="mt-2 font-[var(--font-fraunces)] text-4xl font-semibold tracking-[-0.03em]">
          Wallet
        </h1>
      </header>

      <section className="rounded-[1.75rem] border border-white/8 bg-gradient-to-br from-[#534AB7]/20 via-[#16161f] to-[#12121a] p-5">
        <p className="text-sm text-[#8888a0]">Available balance</p>
        <p className="mt-3 font-[var(--font-fraunces)] text-5xl font-semibold tracking-[-0.04em] text-[#e0e0e8]">
          {walletSummary.balance}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <WalletStat label="Spend limit" value={walletSummary.spendLimit} />
          <WalletStat label="Network" value={walletSummary.network} />
        </div>
      </section>
    </div>
  );
}

function WalletStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/8 bg-black/15 p-4">
      <p className="font-[var(--font-dm-mono)] text-[0.62rem] uppercase tracking-[0.22em] text-[#55556a]">
        {label}
      </p>
      <p className="mt-2 text-sm text-[#e0e0e8]">{value}</p>
    </div>
  );
}
