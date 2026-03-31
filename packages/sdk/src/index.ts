/**
 * Tessera SDK
 *
 * An open-source SDK for issuing and verifying Tessera identity credentials.
 * Built on Semaphore for the zero-knowledge layer.
 *
 * @example
 * ```typescript
 * // === Issuer side (your server) ===
 * import { createIssuer } from 'tessera-sdk';
 * const issuer = createIssuer();
 * const { credential, identitySecret } = issuer.issue({
 *   tier: 1,
 *   jurisdiction: 'EU',
 *   anchorHash: 'sha256-of-bank-account-id',
 * });
 *
 * // === User side (proving) ===
 * import { prove } from 'tessera-sdk';
 * const proof = await prove(
 *   identitySecret,
 *   group,
 *   credential,
 *   'platform-xyz',
 * );
 *
 * // === Platform side (verifying) ===
 * import { createVerifier } from 'tessera-sdk';
 * const verifier = createVerifier({
 *   platformScope: 'platform-xyz',
 *   minimumTier: 2,
 * });
 * const result = await verifier.verify(proof);
 * // { valid: true, type: 'human', tier: 1, scope: null }
 * ```
 *
 * @packageDocumentation
 */

// Issuer (credential creation)
export { createIssuer } from './issuer.js';

// Prover (user-side proof generation)
export { prove } from './prover.js';

// Delegation (agent authorization)
export { createDelegation } from './delegation.js';

// Verifier (platform-side verification)
export { createVerifier } from './verifier.js';

// Types
export type {
  // Anchor
  AnchorTier,
  AnchorMetadata,
  Jurisdiction,
  // Credentials
  TesseraCredential,
  // Agent delegation
  AgentScope,
  AgentDelegation,
  // Proofs
  TesseraProof,
  SemaphoreProofData,
  // Verification
  VerificationResult,
  TesseraVerifierConfig,
  // Issuer
  TesseraIssuerConfig,
} from './types.js';
