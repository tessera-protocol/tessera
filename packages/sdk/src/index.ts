/**
 * Tessera SDK
 *
 * An open-source SDK for verifying Tessera identity credentials.
 * Use `createVerifier()` to get started.
 *
 * @example
 * ```typescript
 * import { createVerifier } from 'tessera-sdk';
 *
 * const verifier = createVerifier({
 *   nullifierRegistryUrl: 'https://registry.tessera.example',
 * });
 *
 * const result = await verifier.verify(credential);
 * // { valid: true, type: 'human', tier: 1, scope: null }
 * ```
 *
 * @packageDocumentation
 */

export { createVerifier } from './verify.js';

export type {
  TesseraHumanCredential,
  TesseraAgentCredential,
  TesseraCredential,
  TesseraConfig,
  VerificationResult,
  AgentScope,
  AnchorTier,
  HumanCredentialClaims,
  Jurisdiction,
} from './types.js';
