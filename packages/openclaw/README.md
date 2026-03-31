# `@tessera-protocol/openclaw`

Tessera Guard for OpenClaw is a fail-closed permission middleware for agent actions. It intercepts sensitive actions like messaging, payments, shell execution, and content publishing, then blocks them unless a valid Tessera credential explicitly authorises the operation.

[![npm](https://img.shields.io/npm/v/@tessera-protocol/sdk)](https://www.npmjs.com/package/@tessera-protocol/sdk)

## Quick Start

```ts
import { createGuard } from '@tessera-protocol/openclaw';

const guard = createGuard({
  credential: process.env.TESSERA_AGENT_CREDENTIAL!,
});

const result = await guard.check('email.send', { recipientCount: 5 });

if (!result.allowed) {
  console.log(result.reason);
  console.log(result.suggestion);
  process.exit(1);
}

// Proceed with the action
```

## What the Guard Checks

- `message.send`: requires posting/message scope and respects recipient limits
- `email.send`: requires posting/message scope and can enforce domain restrictions
- `payment.intent`: requires transaction scope, amount, currency, and category limits
- `exec.shell`: denied by default unless shell execution is explicitly delegated
- `content.publish`: requires posting scope
- unknown actions: denied by default

## Online vs Offline

- Offline mode verifies the embedded Tessera credential and delegation locally using the SDK's cryptographic primitives.
- Online mode also calls an issuer endpoint at `POST /guard/check`. If the endpoint is unavailable or returns an error, the guard denies the action.

## Human-Legible Permission State

`guard.getAgentMessage()` returns a natural-language summary of the agent's current permissions so the agent can explain its constraints directly in conversation.
