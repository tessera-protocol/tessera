/**
 * Tessera Protocol — Core Types
 *
 * These types define the credential schemas and verification
 * interfaces specified in the Tessera protocol (spec v0.1).
 */

/** Anchor tier representing the assurance level of identity verification. */
export type AnchorTier = 1 | 2 | 3 | 4;

/** Supported anchor jurisdictions (ISO 3166-1 or region codes). */
export type Jurisdiction = string;

/**
 * The core claims embedded in a human credential.
 * No PII is included — only the fact of verification.
 */
export interface HumanCredentialClaims {
  isUniqueHuman: true;
  anchorTier: AnchorTier;
  anchorJurisdiction: Jurisdiction;
  issuedAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp
}

/**
 * A Tessera credential proving the holder is a verified unique human.
 * Conforms to W3C Verifiable Credential structure.
 */
export interface TesseraHumanCredential {
  type: 'TesseraHumanCredential';
  version: '1.0';
  claims: HumanCredentialClaims;
  proof: string; // ZK proof (opaque to verifiers)
  nullifier: string; // One-way hash for double-presentation detection
}

/**
 * Scope defines what an agent is permitted to do.
 * A child scope cannot exceed its parent.
 */
export interface AgentScope {
  canPost?: boolean;
  canTransact?: boolean;
  maxTransactionValue?: number;
  currency?: string;
  allowedCategories?: string[];
  [key: string]: unknown; // Extensible for platform-specific scopes
}

/**
 * A delegated credential granting an agent limited authority
 * to act on behalf of a verified human.
 */
export interface TesseraAgentCredential {
  type: 'TesseraAgentCredential';
  parentCredentialId: string; // Hash of the parent credential
  agentName: string;
  scope: AgentScope;
  issuedAt: number;
  expiresAt: number;
  revocationEndpoint: string;
}

/** Union of all Tessera credential types. */
export type TesseraCredential = TesseraHumanCredential | TesseraAgentCredential;

/**
 * The result returned by the verification SDK.
 * This is the primary interface platforms consume.
 */
export interface VerificationResult {
  /** Whether the credential is cryptographically valid and not revoked. */
  valid: boolean;
  /** Whether the presenter is a human or a delegated agent. */
  type: 'human' | 'agent';
  /** The anchor tier of the root human credential. */
  tier: AnchorTier;
  /** Agent scope (null for human credentials). */
  scope: AgentScope | null;
  /** Reason for failure, if valid is false. */
  error?: string;
}

/**
 * Configuration for the Tessera verification SDK.
 */
export interface TesseraConfig {
  /** URL of the nullifier registry for double-presentation checks. */
  nullifierRegistryUrl: string;
  /** Minimum anchor tier this platform accepts (default: 1). */
  minimumTier?: AnchorTier;
  /** Request timeout in milliseconds (default: 5000). */
  timeoutMs?: number;
}
