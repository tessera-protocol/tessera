# Tessera

[![npm](https://img.shields.io/npm/v/@tessera-protocol/sdk)](https://www.npmjs.com/package/@tessera-protocol/sdk)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

Tessera Guard is a permission layer for agent actions.

Today, the live integration is OpenClaw: a real Guard plugin blocks `exec.shell` by default, allows it while a valid credential is active, allows it again on the next identical action, and blocks it again immediately after revocation. The same Guard model now also covers `message.send` at the real hook boundary.

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
- Tessera Guard enforces a real execution-time boundary for `exec`
- Tessera Guard also enforces `message.send` at the real hook boundary
- `/guard` is the beginning of a local control plane
- local grant / revoke affects the real credential source used by the plugin
- recent Guard decisions can be inspected from the dashboard and the plugin event log

## Why This Exists

Most agent runtimes still fall back to one of three bad patterns:

- ambient authority: if the agent already has the token or tool handle, it can act
- repeated prompts: the human has to re-approve each action, which breaks autonomy
- runtime-specific permissions: each framework invents its own incompatible policy model

Tessera Guard is trying to establish a narrower primitive:

- who authorized this agent?
- what action class is it allowed to perform?
- when does that authority expire?
- can it be revoked before the next action executes?

## Observability

The current observability surface is local, but real:

- `/guard` shows runtime, agent, plugin, and credential state
- `/guard` shows recent guarded actions and decision history
- the event stream reflects real transitions such as blocked -> allowed -> allowed -> revoked/blocked
- the OpenClaw Guard plugin also writes a local JSONL decision log used by the dashboard

See the [Quickstart](./QUICKSTART.md) for the exact local flow.

## Current Scope

Today:

- OpenClaw Guard
- local durable `exec.shell` demo
- `message.send` hook-boundary enforcement with the same scoped grant / revoke model
- local dashboard-backed grant / revoke flow

Later:

- broader runtime integrations
- hosted issuer / verification infrastructure
- richer wallet / protocol surface where it actually helps the authorization flow

OpenClaw is the proving ground and the wedge, not the final universe.

## Core Model

- human root credential
- agent identity
- scoped delegation
- execution-time verification
- revocation

## Packages

- [`openclaw-guard-plugin/`](./openclaw-guard-plugin): local OpenClaw Guard plugin and demo assets
- [`packages/openclaw/`](./packages/openclaw): Tessera Guard package surface for OpenClaw-related work
- [`packages/sdk/`](./packages/sdk): core credential, delegation, and verification SDK
- [`services/issuer/`](./services/issuer): issuer and online revocation / verification service
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
