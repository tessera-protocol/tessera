# Tessera Guard for OpenClaw

## Description

Tessera Guard is a permission middleware for OpenClaw. It blocks sensitive actions unless the bound Tessera credential explicitly authorises them.

Protected action classes:

- `message.send`
- `email.send`
- `payment.intent`
- `exec.shell`
- `content.publish`

Unknown actions are denied by default.

## Installation

```bash
npm install @tessera-protocol/openclaw
```

## Configuration

Bind a serialized Tessera agent credential to the guard:

```ts
import { createGuard } from '@tessera-protocol/openclaw';

const guard = createGuard({
  credential: process.env.TESSERA_AGENT_CREDENTIAL!,
  trustedIssuerKeys: [process.env.TESSERA_ISSUER_PUBLIC_KEY!],
  issuerUrl: 'http://localhost:3001',
  offlineMode: true,
});
```

The credential should be a JWT-like token containing:

- the parent Tessera human credential
- the delegated agent scope
- delegation signature metadata
- optional issuer URL / status metadata

## Example Usage

Before any sensitive action:

```ts
const result = await guard.check('email.send', { recipientCount: 5 });

if (!result.allowed) {
  console.log(result.reason);
  console.log(result.suggestion);
  return;
}
```

To let the agent describe its current permission state:

```ts
guard.getAgentMessage();
```

## Tools

- `tessera_check_permission`
- `tessera_show_permissions`
- `tessera_request_upgrade`

Use `createSkillHandlers(guard)` from the package to bind executable handler functions for these tools inside the host runtime.
