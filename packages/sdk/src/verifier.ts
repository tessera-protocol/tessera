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
  AgentDelegation,
  VerifyOptions,
} from './types.js';
import {
  isScopeContained,
  normalizeSemaphoreScope,
  verifyCredentialSignature,
  verifyDelegationSignature,
} from './crypto.js';
import { createNullifierRegistry } from './nullifier-registry.js';

/**
 * Create a Tessera verifier for a platform.
 *
 * @example
 * ```typescript
 * import { createVerifier } from 'tessera-sdk';
 *
 * const verifier = createVerifier({
 *   platformId: 'my-social-network',
 *   trustedIssuerPublicKeys: ['issuer-public-key-pem'],
 *   trustedGroupRoots: ['current-merkle-root', 'previous-merkle-root'],
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
  const nullifierRegistry = createNullifierRegistry(config.nullifierDbPath);

  return {
    /**
     * Verify a Tessera proof.
     *
     * This is the main entry point for platforms. It checks:
     * - ZK proof validity (via Semaphore)
     * - Merkle root is trusted by this verifier
     * - Credential expiry
     * - Anchor tier meets minimum
     * - Nullifier not previously seen (Sybil prevention)
     * - Agent delegation validity (if applicable)
     */
    async verify(
      proof: TesseraProof,
      options?: VerifyOptions,
    ): Promise<VerificationResult> {
      const isAgent = !!proof.delegation;
      const resultType = isAgent ? 'agent' as const : 'human' as const;
      const tier = proof.credential.anchor.tier;
      const trustedRoots = options?.trustedGroupRoots ?? config.trustedGroupRoots ?? [];

      // Step 1: Verify the issuer signature before trusting any credential claims.
      if (
        !verifyCredentialSignature(
          proof.credential,
          config.trustedIssuerPublicKeys,
        )
      ) {
        return {
          valid: false,
          type: resultType,
          tier,
          scope: proof.delegation?.scope ?? null,
          error: 'Credential signature verification failed',
        };
      }

      // Step 2: Bind the proof to this platform.
      if (
        proof.platformId !== config.platformId ||
        proof.semaphoreProof.scope !== normalizeSemaphoreScope(config.platformId)
      ) {
        return {
          valid: false,
          type: resultType,
          tier,
          scope: proof.delegation?.scope ?? null,
          error: 'Proof was generated for a different platform',
        };
      }

      if (!trustedRoots.includes(proof.semaphoreProof.merkleTreeRoot)) {
        return {
          valid: false,
          type: resultType,
          tier,
          scope: proof.delegation?.scope ?? null,
          error: 'Proof was generated against an untrusted group root',
        };
      }

      // Step 3: Check credential expiry
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

      // Step 4: Enforce minimum anchor tier
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

      // Step 5: Verify the Semaphore ZK proof
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

      // Step 6: Validate agent delegation (if applicable)
      if (isAgent && proof.delegation) {
        const delegationError = validateDelegation(
          proof.delegation,
          proof.credential.holderPublicKey,
          proof.credential.identityCommitment,
          now,
        );
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

      // Step 7: Check nullifier (double-presentation detection)
      const nullifier = proof.semaphoreProof.nullifier;
      if (!nullifierRegistry.record(config.platformId, nullifier)) {
        return {
          valid: false,
          type: resultType,
          tier,
          scope: proof.delegation?.scope ?? null,
          error: 'This credential has already been presented on this platform',
        };
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
      return nullifierRegistry.has(config.platformId, nullifier);
    },

    /**
     * Get the count of unique verified users on this platform.
     */
    getVerifiedCount(): number {
      return nullifierRegistry.count(config.platformId);
    },

    /**
     * Close the underlying SQLite connection.
     */
    close(): void {
      nullifierRegistry.close();
    },
  };
}

/**
 * Validate an agent delegation token.
 * Returns null if valid, or an error message.
 */
function validateDelegation(
  delegation: AgentDelegation,
  holderPublicKey: string,
  credentialIdentityCommitment: string,
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

  if (delegation.parentCommitment !== credentialIdentityCommitment) {
    return 'Agent delegation parent commitment does not match credential';
  }

  if (!delegation.parentSignature) {
    return 'Agent delegation missing parent signature';
  }

  if (!verifyDelegationSignature(delegation, holderPublicKey)) {
    return 'Agent delegation signature verification failed';
  }

  if (!isScopeContained(delegation.scope, delegation.parentScope)) {
    return 'Agent delegation scope exceeds parent scope';
  }

  return null;
}
