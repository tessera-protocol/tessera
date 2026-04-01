# Tessera

[![npm](https://img.shields.io/npm/v/@tessera-protocol/sdk)](https://www.npmjs.com/package/@tessera-protocol/sdk)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

Tessera is the permission layer for AI agents.

Tessera Guard blocks sensitive agent actions unless a valid human-delegated credential authorizes them. It verifies scope, expiry, and revocation at execution time.

## Why This Exists

AI agents can now send messages, execute code, make purchases, and publish content. Most runtimes still rely on one of three bad patterns:

- ambient authority: if the agent has a token or tool handle, it can act
- repeated approval prompts: the human has to approve every step
- runtime-specific permissions: every framework invents its own policy model

What is missing is a portable way to answer, at the moment of execution:

- who authorized this agent?
- what is it allowed to do?
- when does that authority expire?
- can that authority be revoked right now?

That is the narrow problem Tessera solves.

## First Product: Tessera Guard

Tessera Guard is the first product and the current wedge.

It sits between an agent runtime and sensitive tools. Before the runtime is allowed to execute a guarded action, Guard verifies:

- the credential chain is valid
- the issuer and delegation signatures are valid
- the requested action is within scope
- the credential is not expired
- the credential has not been revoked

Initial guarded action classes:

- `message.send`
- `payment.intent`
- `exec.shell`
- `content.publish`

## Small Example

```ts
import { createGuard } from '@tessera-protocol/openclaw';

const guard = createGuard({
  credential: process.env.TESSERA_AGENT_CREDENTIAL!,
  trustedIssuerKeys: [process.env.TESSERA_ISSUER_PUBLIC_KEY!],
  offlineMode: false,
  issuerUrl: 'http://localhost:3001',
});

const result = await guard.check('email.send', {
  recipientCount: 5,
  recipientDomains: ['example.com'],
});

if (!result.allowed) {
  console.error(result.reason);
  console.error(result.suggestion);
  return;
}

// Safe to proceed with the sensitive action.
```

## Why Agent Runtimes Need This

Tessera gives runtimes and tool gateways a deterministic execution-time boundary.

Instead of trusting that an agent “probably should” be allowed to act, the runtime can require proof that:

- a human root credential exists
- authority was delegated to this agent
- the delegation covers this class of action
- the delegation is still live

That makes agent permissioning portable across runtimes, MCP servers, gateways, and platforms.

## Core Model

- Human root credential: establishes that a human principal is eligible to delegate authority.
- Agent identity: gives each agent its own cryptographic subject.
- Scoped delegation: encodes what the agent may do, for how long, and under what limits.
- Execution-time verification: checks the request when the action is about to happen.
- Revocation: lets a human kill delegated authority fast enough to matter.

## OpenClaw First, Not OpenClaw Only

OpenClaw is the first integration and the fastest path to real usage, because it already exposes high-risk tool calls and an agent-centric developer audience.

Tessera is not intended to stay OpenClaw-specific. The long-term direction is cross-runtime agent authorization infrastructure:

- OpenClaw today
- MCP servers and gateways next
- broader coding agents, workflow agents, and API-facing agent platforms after that

## Packages

- [`packages/openclaw/`](./packages/openclaw): Tessera Guard for OpenClaw
- [`packages/sdk/`](./packages/sdk): core credential, delegation, and verification SDK
- [`services/issuer/`](./services/issuer): issuer and online revocation / verification service
- [`packages/cli-demo/`](./packages/cli-demo): protocol demo script
- [`apps/web/`](./apps/web): demo wallet app for credentials and agent delegation

## Links

- [Whitepaper v0.6 draft](./docs/whitepaper.pdf)
- [Landing page](./docs/index.html)
- [OpenClaw Guard package](./packages/openclaw/README.md)
- [SDK package](./packages/sdk/README.md)
- [Protocol spec](./spec/v0.1/tessera-spec.md)
- [Contributing guide](./CONTRIBUTING.md)

## License

Apache 2.0. See [LICENSE](./LICENSE).
