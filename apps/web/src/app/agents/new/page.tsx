"use client";

import Link from "next/link";
import { useState } from "react";

const expiryOptions = ["1 hour", "24 hours", "7 days", "30 days"];

export default function NewAgentPage() {
  const [step, setStep] = useState<"setup" | "confirm">("setup");
  const [name, setName] = useState("");
  const [browse, setBrowse] = useState(true);
  const [post, setPost] = useState(true);
  const [transact, setTransact] = useState(true);
  const [messages, setMessages] = useState(false);
  const [limit, setLimit] = useState(50);
  const [expiry, setExpiry] = useState("7 days");

  const token =
    "eyJhbGciOiJFZERTQSIsInR5cCI6InRlc3NlcmErYWdlbnQifQ.eyJwYXJlbnQiOiIweDdhOGYzYzIxIiwibmFtZSI6Im15LXJlc2VhcmNoLWFnZW50Iiwic2NvcGUiOnsiYnJvd3NlIjp0cnVlLCJwb3N0Ijp0cnVl...";

  if (step === "confirm") {
    const scopes = [browse && "browse", post && "post", transact && "transact", messages && "messages"]
      .filter(Boolean)
      .join(", ");

    return (
      <div className="py-4">
        <button
          onClick={() => setStep("setup")}
          className="mb-5 flex items-center gap-1.5"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7F77DD"
            strokeWidth="1.5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-sm font-medium text-brand-purple-light">
            Back
          </span>
        </button>

        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-status-green/12">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7ec89f"
              strokeWidth="2"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="mb-1 font-display text-[22px] font-semibold text-white">
            Wallet issued
          </h1>
          <p className="text-[13px] text-content-muted">
            {name || "my-agent"} is ready to go
          </p>
        </div>

        <div className="mb-4 rounded-[14px] border border-line bg-surface-raised p-4">
          <div className="flex justify-between border-b border-line-subtle py-2">
            <span className="text-[13px] text-content-muted">Permissions</span>
            <span className="font-mono text-[13px] text-content-primary">
              {scopes}
            </span>
          </div>
          <div className="flex justify-between border-b border-line-subtle py-2">
            <span className="text-[13px] text-content-muted">
              Spending limit
            </span>
            <span className="font-mono text-[13px] text-status-warm">
              {limit} EUR
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-[13px] text-content-muted">Expires</span>
            <span className="font-mono text-[13px] text-content-primary">
              {expiry}
            </span>
          </div>
        </div>

        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-content-muted">
          Credential token
        </p>
        <div className="mb-3.5 break-all rounded-[10px] border border-line bg-surface-base p-3.5 font-mono text-[11px] leading-relaxed text-content-muted">
          {token}
        </div>
        <div className="mb-6 flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-brand-purple/15 py-3 text-[13px] font-semibold text-brand-purple-light">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy
          </button>
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-content-dim/[0.08] py-3 text-[13px] font-semibold text-content-muted">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share
          </button>
        </div>

        <div className="rounded-xl border border-line bg-surface-raised p-4">
          <p className="mb-2 text-[13px] font-medium text-content-primary">
            Next step
          </p>
          <p className="text-xs leading-relaxed text-content-muted">
            Paste this token into your agent&apos;s configuration file. For
            Claude Code, add it to{" "}
            <span className="font-mono text-[11px] text-brand-purple-pale">
              ~/.claude/tessera.json
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4">
      <Link href="/agents" className="mb-5 flex items-center gap-1.5">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7F77DD"
          strokeWidth="1.5"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="text-sm font-medium text-brand-purple-light">
          Agents
        </span>
      </Link>

      <h1 className="mb-1.5 font-display text-[22px] font-semibold tracking-tight text-white">
        New agent wallet
      </h1>
      <p className="mb-6 text-[13px] leading-relaxed text-content-muted">
        Issue a credential for your AI agent with scoped permissions and an
        expiry
      </p>

      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-content-muted">
        Agent name
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. claude-code, mcp-browser"
        className="mb-5 w-full rounded-[10px] border border-line bg-surface-raised px-4 py-3.5 text-[15px] text-content-primary outline-none placeholder:text-content-dim focus:border-brand-purple"
      />

      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-content-muted">
        Permissions
      </p>
      <div className="mb-5 rounded-[14px] border border-line bg-surface-raised px-5">
        {[
          { label: "Browse", desc: "Access web content", state: browse, set: setBrowse },
          { label: "Post content", desc: "Publish on your behalf", state: post, set: setPost },
          { label: "Transact", desc: "Make purchases or payments", state: transact, set: setTransact },
          { label: "Send messages", desc: "Email, chat, or notifications", state: messages, set: setMessages },
        ].map((perm, index, arr) => (
          <div
            key={perm.label}
            className={`flex items-center justify-between py-3.5 ${index < arr.length - 1 ? "border-b border-line-subtle" : ""}`}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-content-primary">{perm.label}</span>
              <span className="text-[11px] text-content-dim">{perm.desc}</span>
            </div>
            <button
              onClick={() => perm.set(!perm.state)}
              className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors ${perm.state ? "bg-brand-purple" : "bg-line"}`}
            >
              <div
                className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-[left] ${perm.state ? "left-[21px]" : "left-[3px]"}`}
              />
            </button>
          </div>
        ))}
      </div>

      <div className="mb-5 rounded-[14px] border border-line bg-surface-raised px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-content-primary">Spending limit</span>
          <span className="font-mono text-base font-semibold text-status-warm">
            {limit} EUR
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="500"
          step="10"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="mb-2 w-full"
        />
        <div className="flex justify-between font-mono text-[10px] text-content-dim">
          <span>0</span>
          <span>500 EUR</span>
        </div>
      </div>

      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-content-muted">
        Expiry
      </p>
      <div className="mb-8 flex flex-wrap gap-2">
        {expiryOptions.map((opt) => (
          <button
            key={opt}
            onClick={() => setExpiry(opt)}
            className={`rounded-[10px] px-[18px] py-2.5 text-[13px] font-medium transition-all ${
              expiry === opt
                ? "border border-brand-purple bg-brand-purple/15 text-brand-purple-pale"
                : "border border-line bg-surface-raised text-content-muted hover:border-content-dim"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <button
        onClick={() => setStep("confirm")}
        className="w-full rounded-xl bg-brand-purple py-4 text-[15px] font-semibold text-white transition-colors hover:bg-brand-purple-dark"
      >
        Issue agent wallet
      </button>
    </div>
  );
}
