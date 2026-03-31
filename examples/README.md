# Examples

## Basic Platform Integration

This example shows how a platform would verify a Tessera credential
presented by a user or agent.

```typescript
import { createVerifier, type TesseraHumanCredential } from 'tessera-sdk';

// 1. Create a verifier with your platform's requirements
const verifier = createVerifier({
  nullifierRegistryUrl: 'https://registry.tessera.example',
  minimumTier: 2,      // Require at least card verification
  timeoutMs: 3000,     // 3 second timeout for registry checks
});

// 2. When a user/agent presents a credential, verify it
async function handleCredentialPresentation(credential: TesseraHumanCredential) {
  const result = await verifier.verify(credential);

  if (!result.valid) {
    console.error(`Verification failed: ${result.error}`);
    return;
  }

  if (result.type === 'human') {
    console.log(`Verified human (Tier ${result.tier})`);
    // Grant access
  }

  if (result.type === 'agent') {
    console.log(`Verified agent with scope:`, result.scope);
    // Check scope before allowing actions
    if (result.scope?.canPost) {
      // Allow posting
    }
  }
}
```

## Agent Scope Checking

```typescript
import { type VerificationResult } from 'tessera-sdk';

function canAgentPerformAction(
  result: VerificationResult,
  action: 'post' | 'transact',
  amount?: number,
): boolean {
  if (!result.valid || result.type !== 'agent' || !result.scope) {
    return false;
  }

  if (action === 'post') {
    return result.scope.canPost === true;
  }

  if (action === 'transact') {
    if (!result.scope.canTransact) return false;
    if (amount && result.scope.maxTransactionValue) {
      return amount <= result.scope.maxTransactionValue;
    }
    return true;
  }

  return false;
}
```
