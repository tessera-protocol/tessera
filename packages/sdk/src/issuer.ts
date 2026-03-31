/**
 * Tessera Issuer
 *
 * Handles credential issuance after anchor verification.
 *
 * Flow:
 * 1. User connects bank account (anchor verification — external)
 * 2. Issuer creates a Semaphore identity for the user
 * 3. Issuer adds the identity commitment to the credential group
 * 4. Issuer returns the credential (identity + anchor metadata)
 *
 * The Semaphore identity secret must be stored securely by the user.
 * The issuer retains only the identity commitment (public) and
 * the anchor hash (for deduplication).
 */

import { Identity } from '@semaphore-protocol/identity';
import { Group } from '@semaphore-protocol/group';
import type {
  TesseraCredential,
  AnchorMetadata,
  AnchorTier,
  Jurisdiction,
  TesseraIssuerConfig,
} from './types.js';

/** One year in seconds. */
const DEFAULT_CREDENTIAL_LIFETIME = 365 * 24 * 60 * 60;

/** Default Merkle tree depth (supports up to 2^20 = ~1M members). */
const DEFAULT_GROUP_DEPTH = 20;

/**
 * Create a Tessera issuer instance.
 *
 * The issuer manages the credential group (the set of all verified humans)
 * and issues credentials after anchor verification.
 *
 * @example
 * ```typescript
 * import { createIssuer } from 'tessera-sdk';
 *
 * const issuer = createIssuer();
 *
 * // After verifying a user's bank account:
 * const { credential, identitySecret } = issuer.issue({
 *   tier: 1,
 *   jurisdiction: 'EU',
 *   anchorHash: 'sha256-of-bank-account-id',
 * });
 *
 * // Give identitySecret to the user (they store it securely)
 * // Keep credential.identityCommitment for the group
 * ```
 */
export function createIssuer(config?: TesseraIssuerConfig) {
  const group = new Group();
  const anchorHashes = new Set<string>();

  return {
    /**
     * Issue a credential after successful anchor verification.
     *
     * @param params.tier - The anchor tier (1-4)
     * @param params.jurisdiction - The anchor jurisdiction
     * @param params.anchorHash - One-way hash of the anchor identifier (for dedup)
     * @returns The credential and the identity secret (give to user)
     * @throws If the anchor hash has already been used
     */
    issue(params: {
      tier: AnchorTier;
      jurisdiction: Jurisdiction;
      anchorHash: string;
    }): { credential: TesseraCredential; identitySecret: string } {
      // Deduplication check
      if (anchorHashes.has(params.anchorHash)) {
        throw new Error(
          'This anchor has already been used to issue a credential. ' +
          'Each bank account can only be used once.'
        );
      }

      // Create a new Semaphore identity
      const identity = new Identity();

      // Add to the credential group
      group.addMember(identity.commitment);

      // Record the anchor hash for deduplication
      anchorHashes.add(params.anchorHash);

      const now = Math.floor(Date.now() / 1000);

      const anchor: AnchorMetadata = {
        tier: params.tier,
        jurisdiction: params.jurisdiction,
        verifiedAt: now,
      };

      const credential: TesseraCredential = {
        identityCommitment: identity.commitment.toString(),
        anchor,
        expiresAt: now + DEFAULT_CREDENTIAL_LIFETIME,
        // TODO: Replace with actual issuer signature (Ed25519 or similar)
        issuerSignature: 'placeholder-signature',
      };

      return {
        credential,
        // The user must store this securely — it's their ZK identity secret
        identitySecret: identity.export(),
      };
    },

    /**
     * Get the current credential group.
     * Platforms need the group to verify proofs.
     */
    getGroup(): Group {
      return group;
    },

    /**
     * Get the current group root (Merkle root).
     * This is published so verifiers can check proofs.
     */
    getGroupRoot(): string {
      return group.root.toString();
    },

    /**
     * Get the number of verified humans in the group.
     */
    getMemberCount(): number {
      return group.members.length;
    },
  };
}
