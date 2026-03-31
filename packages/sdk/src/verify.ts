/**
 * Tessera Verification SDK
 *
 * This module implements the credential verification flow
 * described in Section 2.4 of the protocol spec.
 *
 * Verification steps:
 * 1. Validate credential structure
 * 2. Verify ZK proof (cryptographic validity)
 * 3. Check nullifier registry (double-presentation detection)
 * 4. Check revocation status (for agent credentials)
 * 5. Enforce platform-level policy (minimum tier, scope)
 */

import type {
  TesseraCredential,
  TesseraHumanCredential,
  TesseraAgentCredential,
  TesseraConfig,
  VerificationResult,
  AnchorTier,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Validates the structural integrity of a credential.
 * Does not verify cryptographic proofs — that's a separate step.
 */
function validateStructure(credential: TesseraCredential): string | null {
  if (!credential || typeof credential !== 'object') {
    return 'Credential must be a non-null object';
  }

  if (credential.type === 'TesseraHumanCredential') {
    return validateHumanCredential(credential);
  }

  if (credential.type === 'TesseraAgentCredential') {
    return validateAgentCredential(credential);
  }

  return `Unknown credential type: ${(credential as Record<string, unknown>).type}`;
}

function validateHumanCredential(cred: TesseraHumanCredential): string | null {
  if (!cred.claims) return 'Missing claims';
  if (cred.claims.isUniqueHuman !== true) return 'isUniqueHuman must be true';
  if (![1, 2, 3, 4].includes(cred.claims.anchorTier)) return 'Invalid anchor tier';
  if (typeof cred.claims.issuedAt !== 'number') return 'Missing issuedAt';
  if (typeof cred.claims.expiresAt !== 'number') return 'Missing expiresAt';
  if (!cred.proof) return 'Missing proof';
  if (!cred.nullifier) return 'Missing nullifier';
  return null;
}

function validateAgentCredential(cred: TesseraAgentCredential): string | null {
  if (!cred.parentCredentialId) return 'Missing parentCredentialId';
  if (!cred.agentName) return 'Missing agentName';
  if (!cred.scope || typeof cred.scope !== 'object') return 'Missing or invalid scope';
  if (typeof cred.issuedAt !== 'number') return 'Missing issuedAt';
  if (typeof cred.expiresAt !== 'number') return 'Missing expiresAt';
  if (!cred.revocationEndpoint) return 'Missing revocationEndpoint';
  return null;
}

/**
 * Check whether a credential has expired.
 */
function isExpired(credential: TesseraCredential): boolean {
  const expiresAt =
    credential.type === 'TesseraHumanCredential'
      ? credential.claims.expiresAt
      : credential.expiresAt;
  return Date.now() / 1000 > expiresAt;
}

/**
 * Verify the zero-knowledge proof attached to a credential.
 *
 * TODO: Replace with actual ZK verification once proof system is selected.
 * Current placeholder accepts any non-empty proof string.
 */
async function verifyProof(_credential: TesseraHumanCredential): Promise<boolean> {
  // PLACEHOLDER — This is where the ZK verifier will go.
  // The choice of proof system (Groth16, PLONK, Halo2) is an open question.
  // See spec §4, "Open Questions".
  console.warn('[tessera-sdk] ZK proof verification is not yet implemented — accepting all proofs');
  return true;
}

/**
 * Check the nullifier registry to detect double-presentation
 * on the same platform.
 *
 * TODO: Implement actual registry check via HTTP.
 */
async function checkNullifier(
  _nullifier: string,
  _registryUrl: string,
  _timeoutMs: number,
): Promise<{ seen: boolean }> {
  // PLACEHOLDER — Will be an HTTP call to the nullifier registry.
  console.warn('[tessera-sdk] Nullifier registry check is not yet implemented');
  return { seen: false };
}

/**
 * Check whether an agent credential has been revoked
 * by its parent human.
 *
 * TODO: Implement actual revocation check via HTTP.
 */
async function checkRevocation(
  _credential: TesseraAgentCredential,
  _timeoutMs: number,
): Promise<{ revoked: boolean }> {
  // PLACEHOLDER — Will call the credential's revocationEndpoint.
  console.warn('[tessera-sdk] Revocation check is not yet implemented');
  return { revoked: false };
}

/**
 * The main verification function. This is the primary entry point
 * for platforms integrating Tessera.
 *
 * @example
 * ```typescript
 * import { createVerifier } from 'tessera-sdk';
 *
 * const verifier = createVerifier({
 *   nullifierRegistryUrl: 'https://registry.tessera.example',
 *   minimumTier: 2,
 * });
 *
 * const result = await verifier.verify(credential);
 * if (result.valid && result.type === 'human') {
 *   // Allow access
 * }
 * ```
 */
export function createVerifier(config: TesseraConfig) {
  const minimumTier: AnchorTier = config.minimumTier ?? 1;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async verify(credential: TesseraCredential): Promise<VerificationResult> {
      // Step 1: Structural validation
      const structureError = validateStructure(credential);
      if (structureError) {
        return {
          valid: false,
          type: credential.type === 'TesseraAgentCredential' ? 'agent' : 'human',
          tier: 1,
          scope: null,
          error: structureError,
        };
      }

      // Step 2: Expiry check
      if (isExpired(credential)) {
        return {
          valid: false,
          type: credential.type === 'TesseraAgentCredential' ? 'agent' : 'human',
          tier: 1,
          scope: null,
          error: 'Credential has expired',
        };
      }

      if (credential.type === 'TesseraHumanCredential') {
        return verifyHuman(credential, minimumTier, config.nullifierRegistryUrl, timeoutMs);
      }

      return verifyAgent(credential, timeoutMs);
    },
  };
}

async function verifyHuman(
  credential: TesseraHumanCredential,
  minimumTier: AnchorTier,
  registryUrl: string,
  timeoutMs: number,
): Promise<VerificationResult> {
  // Step 3: Tier check
  if (credential.claims.anchorTier > minimumTier) {
    return {
      valid: false,
      type: 'human',
      tier: credential.claims.anchorTier,
      scope: null,
      error: `Anchor tier ${credential.claims.anchorTier} is below minimum required tier ${minimumTier}`,
    };
  }

  // Step 4: ZK proof verification
  const proofValid = await verifyProof(credential);
  if (!proofValid) {
    return {
      valid: false,
      type: 'human',
      tier: credential.claims.anchorTier,
      scope: null,
      error: 'ZK proof verification failed',
    };
  }

  // Step 5: Nullifier check
  const { seen } = await checkNullifier(credential.nullifier, registryUrl, timeoutMs);
  if (seen) {
    return {
      valid: false,
      type: 'human',
      tier: credential.claims.anchorTier,
      scope: null,
      error: 'Credential has already been presented on this platform',
    };
  }

  return {
    valid: true,
    type: 'human',
    tier: credential.claims.anchorTier,
    scope: null,
  };
}

async function verifyAgent(
  credential: TesseraAgentCredential,
  timeoutMs: number,
): Promise<VerificationResult> {
  // Step 4: Revocation check
  const { revoked } = await checkRevocation(credential, timeoutMs);
  if (revoked) {
    return {
      valid: false,
      type: 'agent',
      tier: 1, // TODO: resolve parent tier
      scope: credential.scope,
      error: 'Agent credential has been revoked',
    };
  }

  // TODO: Resolve parent credential to get actual tier
  // This requires walking the delegation tree to the root human credential
  return {
    valid: true,
    type: 'agent',
    tier: 1,
    scope: credential.scope,
  };
}
