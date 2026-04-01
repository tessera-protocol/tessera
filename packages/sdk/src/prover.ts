/**
 * Tessera Prover
 *
 * User-side module for generating ZK proofs.
 *
 * When a platform asks a user to prove they're verified,
 * the user generates a Semaphore proof that:
 *   1. Proves they're in the verified humans group
 *   2. Generates a nullifier specific to this platform
 *      (so the platform can detect double-presentation)
 *
 * The proof reveals nothing about the user's identity.
 */

import { Identity } from '@semaphore-protocol/identity';
import { Group } from '@semaphore-protocol/group';
import { generateProof } from '@semaphore-protocol/proof';
import type {
  TesseraProof,
  TesseraCredential,
  AgentDelegation,
} from './types.js';

/**
 * Generate a Tessera proof for presentation to a platform.
 *
 * @param identitySecret - The user's Semaphore identity secret (from issuance)
 * @param group - The current credential group (must contain the user's commitment)
 * @param credential - The user's Tessera credential (contains anchor metadata)
 * @param platformId - The platform's unique identifier (used for nullifier scoping)
 * @param message - Optional message to include in the proof (e.g. a nonce from the platform)
 * @param delegation - Optional agent delegation (if proving on behalf of a human)
 *
 * @example
 * ```typescript
 * import { prove } from '@tessera-protocol/sdk';
 *
 * const proof = await prove(
 *   myIdentitySecret,
 *   currentGroup,
 *   myCredential,
 *   'social-network-xyz',
 * );
 *
 * // Send proof to the platform for verification
 * ```
 */
export async function prove(
  identitySecret: string,
  group: Group,
  credential: TesseraCredential,
  platformId: string,
  message: string = '0',
  delegation?: AgentDelegation,
): Promise<TesseraProof> {
  // Reconstruct the Semaphore identity from the stored secret
  const identity = Identity.import(identitySecret);

  // Check credential hasn't expired
  const now = Math.floor(Date.now() / 1000);
  if (now > credential.expiresAt) {
    throw new Error('Credential has expired');
  }

  // Generate the Semaphore proof
  // - scope: the platform identifier (ensures nullifier is platform-specific)
  // - message: optional nonce or payload
  const semaphoreProof = await generateProof(
    identity,
    group,
    message,
    platformId,
  );

  return {
    semaphoreProof,
    credential,
    platformId,
    delegation,
  };
}
