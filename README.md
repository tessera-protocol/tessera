# Tessera

[![npm](https://img.shields.io/npm/v/@tessera-protocol/sdk)](https://www.npmjs.com/package/@tessera-protocol/sdk)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

Tessera Guard is a runtime-native capability guard for agent actions.

Today, the live integration is OpenClaw: a real Guard plugin blocks `exec.shell` by default, allows it while a valid credential is active, allows it again on the next identical action, and blocks it again immediately after revocation.

## Durable Demo Loop

The current milestone proves a durable authority loop, not a one-shot approval flow:

1. blocked: no credential
2. allowed: grant `exec.shell` from `/guard`
3. allowed: same command again, no re-approval
4. blocked: revoke the credential, then retry

This is implemented live in OpenClaw today.

## Start Here

- [Quickstart](./QUICKSTART.md): install the local OpenClaw Guard plugin, run `/guard`, and reproduce the durable `exec.shell` loop
- [Security Model](./SECURITY_MODEL.md): current trust assumptions, revocation semantics, and demo limitations
- [OpenClaw Guard package](./openclaw-guard-plugin/README.md): plugin-level details and local plugin behavior

## What Works Today

- OpenClaw is the first live runtime integration
- Tessera Guard enforces real runtime boundaries for `exec.shell` and mutation-class tool calls (for example `apply_patch`)
- `message.send` is a real target action class at the hook boundary, but it is not yet live-proven end to end under one clean guarded outbound path
- `/guard` is the beginning of a local control plane
- local grant / revoke affects the real credential source used by the plugin
- recent Guard decisions can be inspected from the dashboard and the plugin event log

## Why This Exists

Most agent runtimes still fall back to one of three bad patterns:

- ambient authority: if the agent already has the token or tool handle, it can act
- repeated prompts: the human has to re-approve each action, which breaks autonomy
- runtime-specific permissions: each framework invents its own incompatible policy model

Tessera Guard is trying to establish a narrower primitive:

- what authority was explicitly delegated?
- what action class is it allowed to perform?
- when does that authority expire?
- can it be revoked before the next action executes?

Tessera currently enforces action class, scope, expiry, revocation state, and quantitative limits. It does not yet enforce the semantic acceptability of action payloads.

## Observability

The current observability surface is local, but real:

- `/guard` shows runtime, agent, plugin, and credential state
- `/guard` shows recent guarded actions and decision history
- the event stream reflects real transitions such as blocked -> allowed -> allowed -> revoked/blocked
- the OpenClaw Guard plugin writes a local JSONL decision log with hash-chained events used by the dashboard

The dashboard write path and the issuer service are demo-only local control surfaces. They must stay on loopback unless real auth is added.

See the [Quickstart](./QUICKSTART.md) for the exact local flow.

## Policy UX Direction

The security model is capability-based, but the product cannot expect most users to author raw policy schemas by hand.

The practical direction is role-first onboarding:

- policies should feel like choosing a role, not authoring a schema
- preset capability profiles and safe defaults should cover common cases first
- raw policy controls should remain available for advanced operators

Examples of likely role shapes include:

- researcher / read-only
- developer / local dev
- assistant / communications
- purchaser / bounded spend
- custom / advanced

## Current Scope

Today:

- OpenClaw Guard
- local durable `exec.shell` demo
- local `code.write`/mutation guard at the same `before_tool_call` boundary
- local dashboard-backed grant / revoke flow

Later:

- broader runtime integrations
- hosted and self-hosted control planes where they improve operator experience
- role-template onboarding and safer default capability profiles

OpenClaw is the proving ground and the wedge, not the final universe.

## Core Model

- identity and authority for AI agents
- scoped capabilities
- runtime enforcement
- revocation
- auditability

## Packages

- [`openclaw-guard-plugin/`](./openclaw-guard-plugin): local OpenClaw Guard plugin and demo assets
- [`packages/openclaw/`](./packages/openclaw): Tessera Guard package surface for OpenClaw-related work
- [`packages/sdk/`](./packages/sdk): core capability, delegation, proof, and verification SDK
- [`services/issuer/`](./services/issuer): local-first issuer and revocation / verification service
- [`apps/web/`](./apps/web): local dashboard and demo wallet surfaces

## Links

- [Quickstart](./QUICKSTART.md)
- [Security Model](./SECURITY_MODEL.md)
- [Whitepaper v0.6 draft](./docs/whitepaper.pdf)
- [Landing page](./docs/index.html)
- [SDK package](./packages/sdk/README.md)
- [Protocol spec](./spec/v0.1/tessera-spec.md)
- [Contributing guide](./CONTRIBUTING.md)

## License

Apache 2.0. See [LICENSE](./LICENSE).
