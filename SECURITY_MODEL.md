# Security Model

This note describes the current Tessera Guard milestone as it exists today in this repo.

It is intentionally narrower than the long-term protocol vision.

## What Tessera Guard Protects Today

Today, Tessera Guard protects one live path:

- OpenClaw `exec` mapped to Tessera `exec.shell`

In the current local milestone, Guard checks:

- whether a credential exists for the current agent
- whether the credential belongs to that agent
- whether the requested action is in scope
- whether the credential is expired
- whether the credential has been revoked

The current local dashboard can grant, revoke, and clear that credential, and the OpenClaw plugin enforces the result at execution time.

## What It Does Not Yet Protect

This repo does not yet provide a complete production authorization stack.

It does not yet provide:

- issuer-backed production credentials
- cryptographic proof presentation in the live plugin path
- replay-resistant proof binding in the live plugin path
- persistent distributed revocation infrastructure
- multi-runtime production enforcement beyond the current OpenClaw milestone
- a full live outbound `message.send` demo

## Trust Assumptions

The current local milestone assumes:

- the local controller can read and write the credential file
- the local OpenClaw runtime and plugin files are trusted
- the local dashboard server is trusted to mutate credential state correctly

If the controller machine or dashboard process is compromised, the attacker can likely:

- grant or revoke credentials
- alter local runtime policy
- modify or delete the event log

That is a limitation of the current local control-plane model, not a solved problem.

## Compromised Controller / Issuer Caveat

Today, the local demo effectively combines controller, issuer, and policy admin roles on one machine.

So:

- a compromised controller can mint or modify local demo credentials
- a compromised issuer in a future system would be able to authorize actions it should not
- a compromised runtime host can bypass or tamper with local enforcement

The current demo should therefore be read as a proof of the execution-time boundary, not as a complete answer to key custody or remote trust.

## Credential Replay

The current live plugin path uses a local JSON credential model.

That means replay resistance is limited:

- the plugin checks credential content and current revocation state
- it does not yet require a fresh cryptographic presentation per action
- it does not yet bind a presentation to a nonce, challenge, or verifier session

In other words, the current milestone demonstrates scope / expiry / revocation behavior, but not a full replay-resistant proof protocol.

## Revocation Semantics

Revocation is enforced before the next guarded action executes.

Current behavior:

- revoke the credential
- the next matching `exec.shell` attempt is blocked immediately

Current caveat:

- revocation does not cancel an action that has already passed the execution boundary
- if an action is already in flight, revoking after that point does not retroactively undo it

So the practical guarantee today is:

- revocation stops subsequent actions
- it does not unwind already-executing work

## Scope Limits and Expiry

The current local credential model enforces:

- explicit action scope
- agent binding
- expiry timestamp

The intended operating model is:

- keep scope narrow
- keep expiry bounded
- revoke when authority is no longer needed

The local demo uses short-lived, file-backed credentials for clarity, not as a final issuance format.

## Observability and Auditability

The current observability surface is local:

- `/guard` shows credential state
- `/guard` shows recent guarded actions
- the OpenClaw plugin writes a local JSONL decision log

This is useful for operator understanding and demo validation, but it is not yet a tamper-evident audit system.

## Local Demo Plumbing vs Final Architecture

The current milestone uses local demo plumbing:

- local JSON credentials
- local file-backed revocation state
- local event log polling
- local OpenClaw config mutation for the durable demo

That is good enough to prove the product loop:

- blocked by default
- allowed while valid
- blocked again after revocation

It should not be confused with the final protocol architecture.

The long-term architecture is expected to separate:

- issuer
- controller
- verifier
- revocation infrastructure
- runtime enforcement

The repo is not claiming that full separation exists today.
