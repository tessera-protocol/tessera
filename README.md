# Tessera

**An open protocol for human and agent identity.**

Tessera anchors digital identity to real-world financial verification, issuing portable cryptographic credentials to humans and the autonomous agents acting on their behalf — without exposing personal data.

> The Roman *tessera hospitalis* was a clay tile broken between two strangers. Each carried a half; reuniting the pieces proved identity and established trust across distance.

---

## The Problem

The internet has no native way to verify that a user is a real, unique human — or that an AI agent is authorised to act on someone's behalf. Current defences (CAPTCHAs, phone verification, email confirmation) test capability, not identity. As autonomous agents proliferate, platforms face an impossible choice: block all automated access or permit unbounded bot activity.

## How Tessera Works

Tessera is a four-layer protocol built on [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/) and zero-knowledge proofs:

| Layer | Purpose |
|-------|---------|
| **Anchor** | Verifies a real human exists via open banking KYC (Plaid, TrueLayer), with fallback tiers (card verification, mobile carrier, social vouching) |
| **Credential** | Issues a privacy-preserving VC proving "unique human" status — no name, email, or PII included |
| **Delegation** | Lets humans delegate scoped, time-limited, revocable credentials to their AI agents |
| **Verification** | Open SDK for platforms to verify credentials in <200ms |

No biometrics. No cryptocurrency. No PII shared with verifying platforms.

## Project Status

🚧 **Early development** — Tessera is pre-alpha. The protocol spec is being formalised and the first SDK implementation is underway. Everything is subject to change.

We are actively seeking feedback from identity researchers, cryptographers, and platform engineers.

## Repository Structure

```
tessera/
├── spec/              # Protocol specification
│   └── v0.1/          # Current working draft
├── packages/
│   └── sdk/           # TypeScript verification SDK
├── examples/          # Integration examples
└── docs/              # Documentation and guides
```

## Getting Started

> **Note:** The SDK is not yet published. This section will be updated when the first alpha is available.
>
> **Runtime requirement:** `packages/sdk` now requires Node `>=22.5` because the verifier uses the built-in `node:sqlite` module for persistent nullifier storage.

```bash
node --version
# v22.5.0 or newer

# then
npm install tessera-sdk
```

```typescript
import {
  createDelegation,
  createIssuer,
  createVerifier,
  prove,
} from 'tessera-sdk';

const issuer = createIssuer();
const { credential, identitySecret, holderSecretKey } = issuer.issue({
  tier: 1,
  jurisdiction: 'EU',
  anchorHash: 'sha256-of-bank-account-id',
});

const delegation = createDelegation(holderSecretKey, credential, {
  agentName: 'research-agent',
  scope: { canPost: true },
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
});

const proof = await prove(
  identitySecret,
  issuer.getGroup(),
  credential,
  'platform-xyz',
  'nonce-123',
  delegation,
);

const verifier = createVerifier({
  platformId: 'platform-xyz',
  trustedIssuerPublicKeys: [issuer.getIssuerPublicKey()],
});

const result = await verifier.verify(proof);
// { valid: true, type: 'agent', tier: 1, scope: { canPost: true } }
```

## Protocol Specification

The full protocol spec is available at [`spec/v0.1/`](./spec/v0.1/). It covers:

- Anchor verification and tiered assurance levels
- Credential schema and zero-knowledge proof structure
- Agent delegation model (scoped, revocable, tree-structured)
- Verification flow and API contract
- Privacy guarantees and threat model

## Contributing

Tessera is in its earliest stage and contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Areas where help is especially needed:

- **Cryptography** — ZK proof system selection (Groth16 vs PLONK vs Halo2), circuit design
- **Identity standards** — W3C VC implementation, DID method design
- **Open banking** — Plaid/TrueLayer integration, cross-jurisdiction coverage
- **Agent systems** — Integration patterns for MCP, LangChain, AutoGPT, etc.
- **Security** — Threat modelling, formal verification

## Design Principles

1. **Privacy by default** — Verifiers learn nothing about you beyond "verified human" or "authorised agent"
2. **No new hardware** — Works with existing bank accounts, no orb scans or biometric devices
3. **Agent-native** — Agent delegation is a first-class primitive, not an afterthought
4. **Open standard** — Protocol spec is CC BY 4.0, reference implementation is Apache 2.0
5. **Incrementally adoptable** — Each layer is independently useful and composable

## Comparison

| | Tessera | Worldcoin | OAuth/OIDC | CAPTCHAs |
|---|---|---|---|---|
| Sybil resistant | ✅ | ✅ | ❌ | ❌ |
| No biometrics | ✅ | ❌ | ✅ | ✅ |
| No crypto required | ✅ | ❌ | ✅ | ✅ |
| Agent delegation | ✅ | ❌ | ❌ | ❌ |
| Privacy-preserving | ✅ | Partial | ❌ | ✅ |
| Open standard | ✅ | ❌ | ✅ | ❌ |

## License

- **Protocol specification** — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Code** — [Apache License 2.0](./LICENSE)

## Links

- [Protocol Spec (v0.1)](./spec/v0.1/)
- [Contributing Guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)

---

*Built by [Guglielmo Reggio](https://github.com/guglielmoreggio)*
