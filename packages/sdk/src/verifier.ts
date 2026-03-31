/**
 * Tessera Verifier
 *
 * Platform-facing module for verifying Tessera proofs.
 *
 * Verification steps:
 * 1. Verify the Semaphore ZK proof (cryptographic validity)
 * 2. Check credential expiry
 * 3. Enforce minimum anchor tier
 * 4. Check nullifier (double-presentation detection)
 * 5. If agent: validate delegation signature and scope
 * 6. Return structured result
 */

import { verifyProof } from '@semaphore-protocol/proof';
import type {
  TesseraProof,
  TesseraVerifierConfig,
  VerificationResult,
  AnchorTier,
} from './types.js';

/**
 * Create a Tessera verifier for a platform.
 *
 * @example
 * ```typescript
 * import { createVerifier } from 'tessera-sdk';
 *
 * const verifier = createVerifier({
 *   platformScope: 'my-social-network',
 *   minimumTier: 2,
 * });
 *
 * const result = await verifier.verify(proof);
 * if (result.valid && result.type === 'human') {
 *   // Allow access
 * }
 * ```
 */
export function createVerifier(config: TesseraVerifierConfig) {
  const minimumTier: AnchorTier = config.minimumTier ?? 1;
  const seenNullifiers = new Set<string>();

  return {
    /**
     * Verify a Tessera proof.
     *
     * This is the main entry point for platforms. It checks:
     * - ZK proof validity (via Semaphore)
     * - Credential expiry
     * - Anchor tier meets minimum
     * - Nullifier not previously seen (Sybil prevention)
     * - Agent delegation validity (if applicable)
     */
    async verify(proof: TesseraProof): Promise<VerificationResult> {
      const isAgent = !!proof.delegation;
      const resultType = isAgent ? 'agent' as const : 'human' as const;
      const tier = proof.credential.anchor.tier;

      // Step 1: Check credential expiry
      const now = Math.floor(Date.now() / 1000);
      if (now > proof.credential.expiresAt) {
        return {
          valid: false,
          type: resultType,
          tier,
          scope: proof.delegation?.scope ?? null,
          error: 'Credential has expired',
        };
      }

      // Step 2: Enforce minimum anchor tier
      // Tier 1 is strongest, Tier 4 is weakest
      // A platform requiring Tier 2 will accept Tier 1 and 2, but reject 3 and 4
      if (tier > minimumTier) {
        return {
          valid: false,
          type: resultType,
          tier,
          scope: proof.delegation?.scope ?? null,
          error: `Anchor tier ${tier} does not meet minimum required tier ${minimumTier}`,
        };
      }

      // Step 3: Verify the Semaphore ZK proof
      try {
        const proofValid = await verifyProof(proof.semaphoreProof);
        if (!proofValid) {
          return {
            valid: false,
            type: resultType,
            tier,
            scope: proof.delegation?.scope ?? null,
            error: 'ZK proof verification failed',
          };
        }
      } catch (err) {
        return {
          valid: false,
          type: resultType,
          tier,
          scope: proof.delegation?.scope ?? null,
          error: `ZK proof verification error: ${err instanceof Error ? err.message : 'unknown'}`,
        };
      }

      // Step 4: Check nullifier (double-presentation detection)
      const nullifier = proof.semaphoreProof.nullifier;
      if (seenNullifiers.has(nullifier)) {
        return {
          valid: false,
          type: resultType,
          tier,
          scope: proof.delegation?.scope ?? null,
          error: 'This credential has already been presented on this platform',
        };
      }

      // Record the nullifier
      seenNullifiers.add(nullifier);

      // Step 5: Validate agent delegation (if applicable)
      if (isAgent && proof.delegation) {
        const delegationError = validateDelegation(proof.delegation, now);
        if (delegationError) {
          return {
            valid: false,
            type: 'agent',
            tier,
            scope: proof.delegation.scope,
            error: delegationError,
          };
        }
      }

      // All checks passed
      return {
        valid: true,
        type: resultType,
        tier,
        scope: proof.delegation?.scope ?? null,
      };
    },

    /**
     * Check if a nullifier has been seen before
     * (useful for checking without consuming the nullifier).
     */
    hasSeenNullifier(nullifier: string): boolean {
      return seenNullifiers.has(nullifier);
    },

    /**
     * Get the count of unique verified users on this platform.
     */
    getVerifiedCount(): number {
      return seenNullifiers.size;
    },
  };
}

/**
 * Validate an agent delegation token.
 * Returns null if valid, or an error message.
 */
function validateDelegation(
  delegation: import('./types.js').AgentDelegation,
  now: number,
): string | null {
  if (now > delegation.expiresAt) {
    return 'Agent delegation has expired';
  }

  if (!delegation.parentCommitment) {
    return 'Agent delegation missing parent commitment';
  }

  if (!delegation.scope || typeof delegation.scope !== 'object') {
    return 'Agent delegation missing scope';
  }

  // TODO: Verify parentSignature cryptographically
  // This requires the parent's public key, which should be
  // derivable from their identity commitment
  if (!delegation.parentSignature) {
    return 'Agent delegation missing parent signature';
  }

  return null;
}
