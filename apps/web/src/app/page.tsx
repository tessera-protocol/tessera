"use client";

import { TesseraMark } from "@/components/tessera-mark";
import { passportCard } from "@/lib/mock-data";

const actionItems = [
  { title: "Show QR", subtitle: "Present your proof", accent: "bg-[#534AB7]/15 text-[#7F77DD]" },
  { title: "Share", subtitle: "Send secure link", accent: "bg-white/5 text-[#e0e0e8]" },
  { title: "Agents", subtitle: "Manage wallets", accent: "bg-[#12121a] text-[#e0e0e8]" },
  { title: "Wallet", subtitle: "Review escrow", accent: "bg-[#f0c674]/15 text-[#f0c674]" },
];

const qrRows = [
  "██ ██ ████  █ ███  ██",
  "█ ██  █  ██ ██  █ ███",
  "███  ██ ███  ███  █ █",
  "█ ███  █  ███ █ ██ ██",
];

export default function PassportPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-[var(--font-dm-mono)] text-xs uppercase tracking-[0.28em] text-[#55556a]">
          Tessera passport
        </p>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-[var(--font-fraunces)] text-4xl font-semibold tracking-[-0.03em] text-[#e0e0e8]">
              Passport
            </h1>
            <p className="mt-1 text-sm text-[#8888a0]">
              Portable proof of verified humanity for apps, wallets, and agent systems.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#534AB7]/30 bg-[#534AB7]/12 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-[#7ec89f]" />
            <span className="text-xs font-medium text-[#7F77DD]">live</span>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-[2rem] border border-[#534AB7]/25 bg-gradient-to-br from-[#16161f] via-[#12121a] to-[#0F1117] shadow-[0_18px_42px_rgba(83,74,183,0.28)]">
        <div className="border-b border-white/6 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-[1.35rem] bg-[#534AB7]/14 p-3 shadow-[inset_0_0_0_1px_rgba(127,119,221,0.2)]">
                <TesseraMark size={44} variant="two-tone" />
              </div>
              <div>
                <p className="font-[var(--font-dm-mono)] text-[0.65rem] uppercase tracking-[0.24em] text-[#55556a]">
                  tessera. human passport
                </p>
                <h2 className="mt-2 font-[var(--font-fraunces)] text-2xl font-semibold text-[#e0e0e8]">
                  {passportCard.holderName}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#534AB7] px-3 py-1 text-xs font-semibold text-white">
                    {passportCard.tier}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#8888a0]">
                    {passportCard.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
              <p className="text-[0.62rem] uppercase tracking-[0.22em] text-[#55556a]">
                credential id
              </p>
              <p className="mt-1 font-[var(--font-dm-mono)] text-xs text-[#e0e0e8]">
                {passportCard.id}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 px-5 py-5">
          <div className="grid grid-cols-2 gap-3">
            <MetadataCard label="Jurisdiction" value={passportCard.jurisdiction} />
            <MetadataCard label="Agents linked" value={`${passportCard.agentWallets}`} />
            <MetadataCard label="Issued" value={passportCard.issuedAt} />
            <MetadataCard label="Expires" value={passportCard.expiresAt} />
          </div>

          <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="max-w-[12rem]">
                <p className="font-[var(--font-dm-mono)] text-[0.62rem] uppercase tracking-[0.24em] text-[#55556a]">
                  presentation QR
                </p>
                <p className="mt-2 text-sm text-[#8888a0]">
                  Rotate this proof for a verifier. The nullifier changes per platform.
                </p>
              </div>
              <div className="min-w-0 flex-1 rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="space-y-1 font-[var(--font-dm-mono)] text-[0.72rem] leading-4 tracking-[0.32em] text-[#AFA9EC]">
                  {qrRows.map((row) => (
                    <div key={row}>{row}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-[var(--font-fraunces)] text-2xl font-semibold text-[#e0e0e8]">
            Quick actions
          </h3>
          <p className="text-xs uppercase tracking-[0.18em] text-[#55556a]">
            static preview
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {actionItems.map((item) => (
            <div
              key={item.title}
              className={`rounded-[1.5rem] border border-white/8 p-4 ${item.accent}`}
            >
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-[#8888a0]">{item.subtitle}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetadataCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] p-4">
      <p className="font-[var(--font-dm-mono)] text-[0.62rem] uppercase tracking-[0.22em] text-[#55556a]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-[#e0e0e8]">{value}</p>
    </div>
  );
}
