/**
 * Tessera Protocol — Core Types
 *
 * These types define the credential schemas and verification
 * interfaces specified in the Tessera protocol (spec v0.1).
 *
 * The ZK layer is provided by Semaphore. Tessera adds anchor
 * tiers, agent delegation, and the platform-facing SDK.
 */

// ── Anchor types ──

/** Anchor tier representing the assurance level of identity verification. */
export type AnchorTier = 1 | 2 | 3 | 4;

/** Supported anchor jurisdictions (ISO 3166-1 or region codes). */
export type Jurisdiction = string;

/** Metadata about the anchor verification, stored alongside the credential. */
export interface AnchorMetadata {
  tier: AnchorTier;
  jurisdiction: Jurisdiction;
  verifiedAt: number; // Unix timestamp
}

// ── Credential types ──

/**
 * A Tessera human credential combines a Semaphore identity
 * (for ZK proofs) with anchor metadata (for tier enforcement).
 *
 * The Semaphore identity handles:
 *   - Group membership proof (I'm a verified human)
 *   - Nullifier generation (I haven't used this on your platform)
 *
 * Tessera adds:
 *   - Anchor tier (how strongly was I verified?)
 *   - Jurisdiction (where was I verified?)
 *   - Expiry (when does this credential expire?)
 */
export interface TesseraCredential {
  /** Semaphore identity commitment (public, used as group member ID). */
  identityCommitment: string;
  /** Ed25519 public key used by the credential holder for delegation signatures. */
  holderPublicKey: string;
  /** Ed25519 public key of the issuing authority. */
  issuerPublicKey: string;
  /** Anchor verification metadata. */
  anchor: AnchorMetadata;
  /** When this credential expires (Unix timestamp). */
  expiresAt: number;
  /** Issuer signature over (identityCommitment, anchor, expiresAt). */
  issuerSignature: string;
}

// ── Agent delegation types ──

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
  [key: string]: unknown;
}

/**
 * A delegated credential granting an agent limited authority
 * to act on behalf of a verified human.
 *
 * This is NOT a ZK credential — it's a signed delegation token
 * that references the parent's Semaphore identity commitment.
 */
export interface AgentDelegation {
  /** Explicit unique identifier for this issuance event. */
  id?: string;
  /** The parent human's identity commitment. */
  parentCommitment: string;
  /** Human-readable agent name. */
  agentName: string;
  /** Optional parent scope for bounded sub-delegation flows. */
  parentScope?: AgentScope | null;
  /** What this agent is allowed to do. */
  scope: AgentScope;
  /** When this delegation was created (Unix timestamp). */
  issuedAt: number;
  /** When this delegation expires (Unix timestamp). */
  expiresAt: number;
  /** Signature by the parent human over this delegation. */
  parentSignature: string;
}

// ── Proof types ──

/**
 * A Tessera proof presented to a verifying platform.
 * Contains the Semaphore ZK proof plus Tessera metadata.
 */
export interface TesseraProof {
  /** The Semaphore proof (membership + nullifier). */
  semaphoreProof: SemaphoreProofData;
  /** The credential metadata (tier, jurisdiction, expiry). */
  credential: TesseraCredential;
  /** Platform identifier this proof was generated for. */
  platformId: string;
  /** If this is an agent, the delegation token. */
  delegation?: AgentDelegation;
}

/** Semaphore proof data structure. */
export interface SemaphoreProofData {
  merkleTreeDepth: number;
  merkleTreeRoot: string;
  nullifier: string;
  message: string;
  scope: string;
  points: string[];
}

// ── Verification types ──

/**
 * The result returned by the verification SDK.
 * This is the primary interface platforms consume.
 */
export interface VerificationResult {
  /** Whether the proof is valid and the credential is not expired. */
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
export interface TesseraVerifierConfig {
  /** Minimum anchor tier this platform accepts (default: 1). */
  minimumTier?: AnchorTier;
  /** The platform identifier (used as Semaphore scope for nullifiers). */
  platformId: string;
  /** Trusted issuer public keys in PEM format. */
  trustedIssuerPublicKeys: string[];
  /** Trusted Semaphore Merkle roots published by the issuer. */
  trustedGroupRoots?: string[];
  /** SQLite file path for nullifier persistence. Defaults to in-memory. */
  nullifierDbPath?: string;
}

export interface VerifyOptions {
  /** Trusted Semaphore Merkle roots for this verification call. */
  trustedGroupRoots?: string[];
}

/**
 * Configuration for the Tessera issuer.
 */
export interface TesseraIssuerConfig {
  /** PEM-encoded Ed25519 private key for the issuer. */
  issuerPrivateKeyPem: string;
  /** PEM-encoded Ed25519 public key paired with issuerPrivateKeyPem. */
  issuerPublicKeyPem: string;
  /** Number of recent Merkle roots to retain for verification race windows. */
  recentRootsLimit?: number;
}
