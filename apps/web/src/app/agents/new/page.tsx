"use client";

const steps = [
  "Name the agent wallet",
  "Define delegation scope",
  "Review transaction limits",
  "Create and export the signed delegation",
];

export default function NewAgentPage() {
  return (
    <div className="space-y-5">
      <header>
        <p className="font-[var(--font-dm-mono)] text-xs uppercase tracking-[0.24em] text-[#55556a]">
          new delegated wallet
        </p>
        <h1 className="mt-2 font-[var(--font-fraunces)] text-4xl font-semibold tracking-[-0.03em]">
          New agent
        </h1>
        <p className="mt-2 text-sm text-[#8888a0]">
          Static flow for the first wallet-creation experience. SDK wiring comes next.
        </p>
      </header>

      <section className="space-y-3 rounded-[1.75rem] border border-white/8 bg-[#16161f] p-5">
        {steps.map((step, index) => (
          <div key={step} className="flex items-start gap-3 rounded-[1.25rem] bg-white/[0.03] p-4">
            <span className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-[#534AB7]/20 text-xs font-semibold text-[#7F77DD]">
              {index + 1}
            </span>
            <div>
              <p className="font-medium text-[#e0e0e8]">{step}</p>
              <p className="mt-1 text-sm text-[#8888a0]">
                Placeholder step content for the mobile wallet flow.
              </p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
