# Tessera Protocol Specification

**Version:** 0.1.0 (Working Draft)
**Status:** Pre-alpha — subject to breaking changes
**Authors:** Guglielmo Reggio
**License:** CC BY 4.0
**Date:** March 2026

---

## 1. Overview

Tessera is an open protocol for issuing privacy-preserving identity credentials to humans and their autonomous agents. It anchors digital identity to real-world financial verification (open banking KYC), produces portable W3C Verifiable Credentials with zero-knowledge proofs, and defines a delegation model for extending trust from humans to AI agents.

### 1.1 Design Goals

| Property | Description |
|----------|-------------|
| **Sybil-resistant** | One real human = one credential. Duplicate issuance is detectable without revealing identity. |
| **Privacy-preserving** | No PII is shared with verifying platforms. Proofs are zero-knowledge. |
| **Agent-native** | Delegation to autonomous agents is a first-class protocol primitive. |
| **Portable** | Credentials work across platforms without re-verification. |
| **Non-biometric** | No iris scans, fingerprints, or facial recognition. |
| **No cryptocurrency** | No token, wallet, or blockchain required for basic usage. |
| **Open** | Protocol spec is CC BY 4.0. Reference implementation is Apache 2.0. |

### 1.2 Threat Model

Tessera defends against the following attack classes:

- **Sybil attacks** — One actor creating many fake identities
- **Credential forgery** — Fabricating or tampering with credentials
- **Scope escalation** — An agent exceeding its delegated permissions
- **Linkability** — Correlating a user's activity across platforms
- **Replay attacks** — Reusing a credential presentation

Tessera does **not** claim to prevent misuse by verified humans. The optional deposit mechanism (§4.4) creates economic accountability without requiring identity disclosure.

## 2. Architecture

The protocol is structured as four composable layers.

### 2.1 Layer 1 — Anchor (Root of Trust)

The anchor is the real-world signal that makes a Tessera credential meaningful. The primary anchor is a bank account connected via open banking APIs (Plaid, TrueLayer, or equivalent).

**Verification checks:**
- Account exists and is active
- Account holder has passed the bank's KYC process
- Account has not previously been used to issue a Tessera credential (deduplication via one-way hash)

**Anchor tiers** (ranked by assurance level):

| Tier | Method | Assurance |
|------|--------|-----------|
| 1 | Open banking (bank account + KYC) | Highest |
| 2 | Card verification (microcharge + name match) | High |
| 3 | Mobile carrier verification (phone bill identity) | Medium |
| 4 | Social graph vouching (existing Tier 1/2 holders attest) | Lower |

The anchor tier is encoded in the issued credential. Platforms set minimum tier requirements for their use case.

**Data retention:** No anchor data is stored after credential issuance. Only a one-way hash of the account identifier is retained for deduplication.

### 2.2 Layer 2 — Credential

Upon successful anchor verification, the Tessera issuer generates a W3C Verifiable Credential:

```json
{
  "type": "TesseraHumanCredential",
  "version": "1.0",
  "claims": {
    "isUniqueHuman": true,
    "anchorTier": 1,
    "anchorJurisdiction": "EU",
    "issuedAt": 1743000000,
    "expiresAt": 1774536000
  },
  "proof": "<zk-proof>"
}
```

**Privacy properties:**
- No name, email, account number, or PII is included
- The zero-knowledge proof allows any verifier to confirm validity without learning anything about the underlying anchor
- Credentials are stored locally on the user's device
- The issuer retains only a nullifier registry (hashed credential IDs) for double-presentation detection

### 2.3 Layer 3 — Agent Delegation

A human credential holder can delegate to one or more agent identities. Each agent credential cryptographically references its parent and encodes scope and expiry:

```json
{
  "type": "TesseraAgentCredential",
  "parentCredentialId": "<human-credential-hash>",
  "agentName": "my-agent",
  "scope": {
    "canPost": true,
    "canTransact": true,
    "maxTransactionValue": 50,
    "currency": "EUR",
    "allowedCategories": ["saas", "api"]
  },
  "issuedAt": 1743000000,
  "expiresAt": 1743604800,
  "revocationEndpoint": "https://tessera.example/revoke"
}
```

**Delegation rules:**
1. A child credential cannot exceed the scope of its parent
2. Revoking a parent immediately invalidates all children
3. The human holds the revocation key; no third party can revoke on their behalf
4. Agents can sub-delegate within their own scope

### 2.4 Layer 4 — Verification API

Platforms integrate via an open-source SDK. Target verification latency: <200ms.

**Verification flow:**
1. Platform requests credential from user/agent
2. User/agent presents signed VC
3. SDK verifies ZK proof (cryptographic validity)
4. SDK checks nullifier registry (not previously used on this platform)
5. SDK checks revocation status
6. Returns verification result

```typescript
interface VerificationResult {
  valid: boolean;
  type: 'human' | 'agent';
  tier: 1 | 2 | 3 | 4;
  scope: AgentScope | null;
}
```

### 2.5 Optional: Deposit Mechanism

For high-risk actions, platforms can require a small refundable deposit held in escrow. Deposits are slashed only upon verified abuse, triggering minimal disclosure (credential status only, not full identity).

## 3. Privacy Guarantees

| Party | Learns |
|-------|--------|
| **Tessera issuer** | That a valid bank account exists (forgotten after issuance) |
| **Verifying platform** | That the presenter is a verified unique human/agent, tier level, and scope |
| **Other users** | Nothing |
| **Tessera servers** | Nullifier hashes only (no credential content) |

## 4. Open Questions

The following areas require further design work:

- **ZK proof system selection** — Groth16, PLONK, or Halo2? Tradeoffs between proof size, verification speed, and trusted setup
- **Cross-anchor deduplication** — Preventing multiple credentials from different banks for the same person
- **Nullifier registry decentralisation** — Reducing single-point-of-failure risk
- **Credential renewal** — Mechanism for refreshing expired credentials without full re-verification
- **Jurisdiction mapping** — Mapping open banking coverage to anchor tier availability
- **Abuse adjudication** — Governance model for deposit slashing decisions
- **DID method** — Defining a `did:tessera` method or using an existing DID method

## 5. References

- [W3C Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model/)
- [W3C Decentralized Identifiers (DIDs)](https://www.w3.org/TR/did-core/)
- [Plaid Open Banking API](https://plaid.com/docs/)
- [TrueLayer API](https://truelayer.com/docs/)
