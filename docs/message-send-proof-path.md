# Message Send Proof Path

This note defines the truth standard for claiming that `message.send` is live-proven end to end.

## Current status

Today, `message.send` is real at the OpenClaw hook boundary, and deny/allow behavior is regression-tested there.

It is **not** yet live-proven end to end under one clean Tessera-enforced and auditable outbound path.

## Candidate runtime path

The cleanest target remains one explicit standard local OpenClaw runtime:

- runtime: `~/.openclaw`
- outbound channel: one configured local channel account, such as Telegram
- runtime command path:
  - `openclaw message send --channel telegram --target <configured-target> --message "..."`
  - or one canonical gateway send path if that is the real hook-bearing path
- Tessera boundary:
  - OpenClaw `message_sending` hook
- audit artifact:
  - `openclaw-guard-plugin/probe-events-<runtime-hash>.jsonl`

## What blocks the proof today

The blocker is not simply “no outbound account.”

The blocker is that the current outbound send paths do not yet yield one single path that both:

1. definitely exercises the loaded Tessera `message_sending` hook in the active runtime
2. definitely uses a real configured outbound channel
3. definitely returns a successful delivery result
4. definitely produces a clear allow/deny decision trace

Observed failure modes in the current environment:

- direct `openclaw message send` can deliver without producing Tessera decision evidence
- gateway `send` does not currently return one usable successful delivery result in the same setup

That means the repo cannot yet honestly claim one clean live-proof path.

## Required proof standard

`message.send` should only be described as live-proven when one outbound runtime path satisfies all of the following:

### 1. One standard runtime path

- one selected local runtime
- one selected outbound channel
- no hidden fallback path

### 2. Hook-boundary enforcement

The send attempt must cross the actual loaded Tessera hook and demonstrate:

- no grant -> blocked
- explicit grant -> allowed
- revoke or clear -> blocked again

### 3. Real delivery result

The allowed case must produce a real outbound delivery result on the configured channel.

### 4. Audit trace

The run must yield a decision trace showing at least:

- action class: `message.send`
- runtime identity
- session or request identity when available
- allow or deny outcome
- reason
- credential or revocation state checked
- delivery result or blocked result

## Canonical demo sequence

The cleanest truthful demo is:

### Case 1 — no grant

- start the standard local runtime with Tessera loaded
- attempt one outbound `message.send`
- result: blocked
- audit: deny recorded

### Case 2 — explicit grant

- attach authority that includes `message.send`
- attempt the same outbound `message.send`
- result: delivered
- audit: allow plus delivery recorded

### Case 3 — revoke

- revoke or clear the credential
- attempt the same outbound `message.send`
- result: blocked again
- audit: deny recorded

## What this patch does not claim

This repo patch adds role-first CLI onboarding and Safety Manifest UX.

It does **not** complete the `message.send` live proof. The status remains:

- hook-boundary real
- not yet one clean live-proven outbound path
