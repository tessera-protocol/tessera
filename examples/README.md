# Examples

These examples are intentionally narrow: Tessera is the permission layer for AI agents, and the first product surface is execution-time authorization for sensitive agent actions.

## Guarded Runtime Check

This is the smallest useful shape of a Tessera integration.

```ts
import { createGuard } from '@tessera-protocol/openclaw';

const guard = createGuard({
  credential: process.env.TESSERA_AGENT_CREDENTIAL!,
  trustedIssuerKeys: [process.env.TESSERA_ISSUER_PUBLIC_KEY!],
  offlineMode: false,
  issuerUrl: 'http://localhost:3001',
});

const result = await guard.check('payment.intent', {
  amount: 42,
  currency: 'EUR',
  category: 'saas',
});

if (!result.allowed) {
  console.error(result.reason);
  console.error(result.suggestion);
  return;
}

// Safe to continue with the guarded action.
```

## Platform-Side Verification

If you are building your own runtime, gateway, or verifier surface directly on the SDK:

```ts
import { createVerifier } from '@tessera-protocol/sdk';

const verifier = createVerifier({
  platformId: 'payments-gateway',
  trustedIssuerPublicKeys: [issuerPublicKey],
  trustedGroupRoots: [currentRoot],
});

const result = await verifier.verify(proof);

if (!result.valid) {
  console.error(result.error);
  return;
}

if (result.type === 'agent') {
  console.log(result.scope);
}
```

## Scope Matching

Tessera is useful when the runtime can map a real action to a clear policy check:

- `message.send`
- `payment.intent`
- `exec.shell`
- `content.publish`

The runtime should evaluate that mapping at execution time, not trust ambient access or stale login state.
