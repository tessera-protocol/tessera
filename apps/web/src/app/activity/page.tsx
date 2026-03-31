"use client";

const events = [
  { text: "Agent claude-code verified", platform: "dev-tools.io", dot: "bg-status-green", time: "2h ago" },
  { text: "Agent mcp-browser verified", platform: "mcp-hub.com", dot: "bg-status-green", time: "5h ago" },
  { text: "Identity verified", platform: "marketplace.app", dot: "bg-status-green", time: "1d ago" },
  { text: "Agent wallet issued", platform: "mcp-browser", dot: "bg-brand-purple-light", time: "1d ago" },
  { text: "Content watermarked", platform: "track_final_v3.wav", dot: "bg-status-warm", time: "3d ago" },
  { text: "Vouched for user", platform: "tess:0x91c2...4a07", dot: "bg-brand-purple-light", time: "3d ago" },
  { text: "Agent wallet issued", platform: "claude-code", dot: "bg-brand-purple-light", time: "5d ago" },
  { text: "Identity verified", platform: "social-network.xyz", dot: "bg-status-green", time: "5d ago" },
  { text: "Credential issued", platform: "Tier 1 - Bank KYC", dot: "bg-status-green", time: "7d ago" },
  { text: "Account created", platform: "tessera.", dot: "bg-brand-purple-light", time: "7d ago" },
];

export default function ActivityPage() {
  return (
    <div className="py-4">
      <h1 className="mb-5 font-display text-[22px] font-semibold tracking-tight text-white">
        Activity
      </h1>

      <div className="overflow-hidden rounded-[14px] border border-line bg-surface-raised">
        {events.map((event, index) => (
          <div
            key={`${event.text}-${index}`}
            className={`flex items-center justify-between px-5 py-3.5 ${index < events.length - 1 ? "border-b border-line-subtle" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${event.dot}`}
              />
              <div>
                <p className="text-[13px] text-content-primary">
                  {event.text}
                </p>
                <p className="text-[11px] text-content-muted">
                  {event.platform}
                </p>
              </div>
            </div>
            <span className="ml-3 shrink-0 font-mono text-[11px] text-content-dim">
              {event.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
