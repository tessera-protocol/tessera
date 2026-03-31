"use client";

import { useTessera } from "@/lib/tessera-context";

function formatRelative(value: number) {
  const diff = Date.now() - value;
  const hours = Math.floor(diff / (60 * 60 * 1000));

  if (hours < 1) {
    return "just now";
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

export default function ActivityPage() {
  const { activity } = useTessera();

  return (
    <div className="py-4">
      <h1 className="mb-5 font-display text-[22px] font-semibold tracking-tight text-white">
        Activity
      </h1>

      <div className="overflow-hidden rounded-[14px] border border-line bg-surface-raised">
        {activity.length === 0 ? (
          <div className="px-5 py-4 text-xs text-content-muted">
            No activity yet.
          </div>
        ) : null}
        {activity.map((event, index) => (
          <div
            key={`${event.text}-${index}`}
            className={`flex items-center justify-between px-5 py-3.5 ${index < activity.length - 1 ? "border-b border-line-subtle" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  event.type === "verification"
                    ? "bg-status-green"
                    : event.type === "revocation"
                      ? "bg-status-red"
                      : event.type === "agent"
                        ? "bg-brand-purple-light"
                        : "bg-status-warm"
                }`}
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
              {formatRelative(event.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
