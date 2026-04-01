/**
 * Tessera SDK
 *
 * Core SDK for Tessera Guard.
 *
 * Tessera is the permission layer for AI agents. This package provides the
 * credential, delegation, proof, and verification primitives that runtimes and
 * gateways use to enforce execution-time authorization for sensitive actions.
 *
 * @example
 * ```typescript
 * // === Issuer side (your server) ===
 * import { createIssuer, createVerifier, generateIssuerKeypair, prove } from '@tessera-protocol/sdk';
 * const issuerKeys = generateIssuerKeypair();
 * const issuer = createIssuer({
 *   issuerPrivateKeyPem: issuerKeys.privateKeyPem,
 *   issuerPublicKeyPem: issuerKeys.publicKeyPem,
 * });
 * const { credential, identitySecret } = issuer.issue({
 *   tier: 1,
 *   jurisdiction: 'EU',
 *   anchorHash: 'sha256-of-bank-account-id',
 * });
 *
 * // === User side (proving) ===
 * const proof = await prove(
 *   identitySecret,
 *   issuer.getGroup(),
 *   credential,
 *   'platform-xyz',
 * );
 *
 * // === Platform side (verifying) ===
 * const verifier = createVerifier({
 *   platformId: 'platform-xyz',
 *   trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
 *   trustedGroupRoots: issuer.getRecentRoots(),
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

// Key generation
export { generateIssuerKeypair } from './crypto.js';

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
  VerifyOptions,
  // Issuer
  TesseraIssuerConfig,
} from './types.js';
