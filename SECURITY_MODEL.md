# SECURITY_MODEL

This repository includes a repo-scoped Tessera Guard demo for OpenClaw.

Tessera starts as a runtime-native capability guard for agent actions, with real enforcement at the runtime boundary rather than only at the network edge.

## Security posture

The demo is intended to fail closed within its scoped runtime flow.

- Without a valid credential, protected actions are denied.
- A grant may temporarily allow only the scoped capability being demonstrated.
- `revoke` and `clear` must restore a non-permissive baseline.
- Ambiguous, missing, or stale runtime state must not leave the demo permissive.
- Example credentials are never used for live enforcement decisions.
- Delegation revocation identity is explicit and unique per issuance event. Legacy tokens without `delegation.id` are accepted only through a compatibility fallback.
- The repo-scoped harness uses conservative PID ownership checks and must not kill unrelated processes based only on stale pidfiles.

Tessera currently enforces action class, scope, expiry, revocation state, and quantitative limits. It does not yet enforce the semantic acceptability of action payloads.

## Scope

This is a repo-scoped demo integration, not a host-wide security boundary.

- Dashboard write endpoints are local demo control paths only.
- The issuer is demo-only and must remain sealed to loopback unless real auth is added.
- Runtime reachability, not config presence alone, determines whether enforcement is actually live.

The live integration surface today is OpenClaw. Enforcement is demonstrated for:
- `exec.shell`
- `code.write` / mutation-class tooling at `before_tool_call` (for example `apply_patch`)
- `message.send` at the real hook boundary, but not yet through one clean live-proven outbound path in the current runtime wiring

Guard decisions are logged in a local hash-chained JSONL stream for operator audit. This improves tamper evidence for local demo forensics, but is not a substitute for remote attestation or production-grade immutable logging.

## Operator expectation

If runtime state and config state disagree, operators should treat runtime reachability as the source of truth for enforcement status.

If state becomes unclear, the system should prefer denial over accidental permission.
